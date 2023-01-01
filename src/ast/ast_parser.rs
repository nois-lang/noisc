use crate::ast::ast::{
    Assignee, AstPair, BinaryOperator, Block, Expression, Identifier, Operand, PatternItem,
    Statement,
};
use crate::ast::expression::{Associativity, OperatorAssociativity, OperatorPrecedence};
use crate::ast::util::{children, custom_error, from_pair, from_span, parse_children};
use crate::parser::Rule;
use enquote::unquote;
use pest::error::Error;
use pest::iterators::{Pair, Pairs};

pub fn parse_file(pairs: &Pairs<Rule>) -> Result<AstPair<Block>, Error<Rule>> {
    parse_block(&pairs.clone().into_iter().next().unwrap())
}

pub fn parse_block(pair: &Pair<Rule>) -> Result<AstPair<Block>, Error<Rule>> {
    match pair.as_rule() {
        Rule::block => {
            let statements = children(pair)
                .into_iter()
                .map(|s| parse_statement(&s))
                .collect::<Result<_, _>>();
            Ok(from_pair(pair, Block(statements?)))
        }
        _ => Err(custom_error(
            pair,
            format!("expected program, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_statement(pair: &Pair<Rule>) -> Result<AstPair<Statement>, Error<Rule>> {
    match pair.as_rule() {
        Rule::return_statement => todo!(),
        Rule::assignment => {
            let ch = children(pair);
            Ok(from_pair(
                pair,
                Statement::Assignment {
                    assignee: parse_assignee(&ch[0])?,
                    expression: parse_expression(&ch[1])?,
                },
            ))
        }
        Rule::expression => parse_expression(pair)
            .map(|expression| from_pair(pair, Statement::Expression { expression })),
        _ => Err(custom_error(
            pair,
            format!("expected statement, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_expression(pair: &Pair<Rule>) -> Result<AstPair<Expression>, Error<Rule>> {
    match pair.as_rule() {
        Rule::expression => {
            let ch = children(pair);
            match &ch[..] {
                [o] => Ok(from_pair(
                    o,
                    Expression::Operand(Box::from(parse_operand(o)?)),
                )),
                _ => parse_complex_expression(pair),
            }
        }
        _ => {
            let t_operand = parse_operand(pair);
            return if let Ok(operand) = t_operand {
                Ok(from_pair(pair, Expression::Operand(Box::from(operand))))
            } else {
                Err(custom_error(
                    pair,
                    format!("expected expression, found {:?}", pair.as_rule()),
                ))
            };
        }
    }
}

pub fn parse_complex_expression(pair: &Pair<Rule>) -> Result<AstPair<Expression>, Error<Rule>> {
    #[derive(Debug, PartialOrd, PartialEq, Clone)]
    enum Node {
        ValueNode(ValueNode),
        ExpNode(ExpNode),
    }
    #[derive(Debug, PartialOrd, PartialEq, Clone)]
    struct ValueNode(AstPair<Expression>);
    #[derive(Debug, PartialOrd, PartialEq, Clone)]
    struct ExpNode(AstPair<BinaryOperator>, Box<Node>, Box<Node>);
    let mut operator_stack: Vec<AstPair<BinaryOperator>> = vec![];
    let mut operand_stack: Vec<Node> = vec![];
    let ch = children(pair);
    for c in ch {
        match c.as_rule() {
            Rule::binary_operator => {
                let o1 = parse_binary_operator(&c)?;
                let mut o2;
                while !operator_stack.is_empty() {
                    o2 = operator_stack.last().unwrap();
                    if (o1.1.associativity() != Associativity::Right
                        && o1.1.precedence() == o2.1.precedence())
                        || o1.1.precedence() < o2.1.precedence()
                    {
                        operator_stack.pop();
                        let r_op = operand_stack.pop().unwrap();
                        let l_op = operand_stack.pop().unwrap();
                        operand_stack.push(Node::ExpNode(ExpNode(
                            o1.clone(),
                            Box::from(l_op.clone()),
                            Box::from(r_op.clone()),
                        )));
                    } else {
                        break;
                    }
                }
                operator_stack.push(o1.clone());
            }
            _ => {
                let operand = parse_expression(&c)?;
                operand_stack.push(Node::ValueNode(ValueNode(operand)));
            }
        }
    }
    while !operator_stack.is_empty() {
        let r_op = operand_stack.pop().unwrap();
        let l_op = operand_stack.pop().unwrap();
        operand_stack.push(Node::ExpNode(ExpNode(
            operator_stack.pop().unwrap(),
            Box::from(l_op.clone()),
            Box::from(r_op.clone()),
        )));
    }
    fn map_node(n: &Node) -> AstPair<Expression> {
        match n {
            Node::ValueNode(ValueNode(v)) => v.clone(),
            Node::ExpNode(ExpNode(op, l, r)) => {
                let exp = Expression::Binary {
                    left_operand: Box::from(map_node(l)),
                    operator: Box::new(op.clone()),
                    right_operand: Box::from(map_node(r)),
                };
                from_span(&op.0, exp)
            }
        }
    }
    Ok(map_node(&operand_stack.pop().unwrap()))
}

pub fn parse_binary_operator(pair: &Pair<Rule>) -> Result<AstPair<BinaryOperator>, Error<Rule>> {
    match pair.as_rule() {
        Rule::binary_operator => children(pair)
            .first()
            .unwrap()
            .try_into()
            .map(|op| from_pair(pair, op)),
        _ => Err(custom_error(
            pair,
            format!("expected binary operator, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_operand(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    match pair.as_rule() {
        Rule::integer => parse_integer(pair),
        Rule::float => parse_float(pair),
        Rule::string => {
            let raw_str = pair.as_str();
            let str = match unquote(raw_str) {
                Ok(s) => Ok(s),
                Err(_) => Err(custom_error(
                    pair,
                    format!("unable to parse string {raw_str}"),
                )),
            }?;
            Ok(from_pair(pair, Operand::String(str)))
        }
        Rule::function_call => parse_function_all(pair),
        Rule::function_init => parse_function_init(pair),
        Rule::list_init => parse_list_init(pair),
        Rule::struct_define => parse_struct_define(pair),
        Rule::enum_define => parse_enum_define(pair),
        Rule::identifier => {
            let id = parse_identifier(pair)?;
            Ok(from_span(&id.0, Operand::Identifier(id.1)))
        }
        _ => Err(custom_error(
            pair,
            format!("expected operand, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_integer(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let num_s = pair.as_str();
    let num = match num_s.parse::<i128>() {
        Ok(n) => Ok(n),
        Err(_) => Err(custom_error(
            pair,
            format!("unable to parse integer {num_s}"),
        )),
    }?;
    Ok(from_pair(pair, Operand::Integer(num)))
}

pub fn parse_float(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let num_s = pair.as_str();
    let num = match num_s.parse::<f64>() {
        Ok(n) => Ok(n),
        Err(_) => Err(custom_error(pair, format!("unable to parse float {num_s}"))),
    }?;
    Ok(from_pair(pair, Operand::Float(num)))
}

pub fn parse_function_all(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let ch = children(pair);
    Ok(from_pair(
        pair,
        Operand::FunctionCall {
            identifier: parse_identifier(&ch[0])?,
            parameters: parse_parameter_list(&ch[1])?,
        },
    ))
}

pub fn parse_function_init(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let ch = children(pair);
    let arguments: Vec<AstPair<Assignee>> = children(&ch[0])
        .into_iter()
        .map(|a| parse_assignee(&a))
        .collect::<Result<_, _>>()?;
    let block = parse_block(&ch[1])?;
    Ok(from_pair(pair, Operand::FunctionInit { arguments, block }))
}

pub fn parse_list_init(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let items: Vec<AstPair<Expression>> = children(pair)
        .into_iter()
        .map(|a| parse_expression(&a))
        .collect::<Result<_, _>>()?;
    Ok(from_pair(pair, Operand::ListInit { items }))
}

pub fn parse_struct_define(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let fields = parse_children(pair, parse_identifier)?;
    Ok(from_pair(pair, Operand::StructDefinition { fields }))
}

pub fn parse_enum_define(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    let values = parse_children(pair, parse_identifier)?;
    Ok(from_pair(pair, Operand::EnumDefinition { values }))
}

fn parse_identifier(pair: &Pair<Rule>) -> Result<AstPair<Identifier>, Error<Rule>> {
    match pair.as_rule() {
        Rule::identifier => Ok(from_pair(pair, Identifier(pair.as_str().to_string()))),
        _ => Err(custom_error(
            pair,
            format!("expected identifier, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_parameter_list(pair: &Pair<Rule>) -> Result<Vec<AstPair<Expression>>, Error<Rule>> {
    match pair.as_rule() {
        Rule::parameter_list => {
            let parameters: Result<Vec<AstPair<Expression>>, Error<Rule>> = children(pair)
                .into_iter()
                .map(|c| parse_expression(&c))
                .collect();
            return parameters;
        }
        _ => Err(custom_error(
            pair,
            format!("expected parameter list, found {:?}", pair.as_rule()),
        )),
    }
}

fn parse_assignee(pair: &Pair<Rule>) -> Result<AstPair<Assignee>, Error<Rule>> {
    match pair.as_rule() {
        Rule::assignee => {
            let ch = children(pair);
            return if ch.len() == 1 && !matches!(ch[0].as_rule(), Rule::pattern_item) {
                let id = parse_identifier(&ch[0]);
                id.map(|i| from_span(&i.0, Assignee::Identifier(from_span(&i.0, i.1))))
            } else {
                let patterns: Result<Vec<AstPair<PatternItem>>, Error<Rule>> =
                    ch.iter().map(|p| parse_pattern_item(p)).collect();
                patterns.map(|p| from_pair(pair, Assignee::Pattern { pattern_items: p }))
            };
        }
        _ => Err(custom_error(
            pair,
            format!("expected assignee, found {:?}", pair.as_rule()),
        )),
    }
}

fn parse_pattern_item(pair: &Pair<Rule>) -> Result<AstPair<PatternItem>, Error<Rule>> {
    Err(custom_error(
        pair,
        format!("patterns are not yet implemented"),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::NoisParser;
    use pest::Parser;

    #[macro_export]
    macro_rules! match_enum {
        ($value:expr, $pattern:pat => $extracted_value:expr) => {
            match $value {
                $pattern => $extracted_value,
                _ => panic!("pattern doesn't match"),
            }
        };
    }

    #[test]
    fn build_ast_empty_block() {
        let source = "";
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        assert!(block.0.is_empty());
    }

    #[test]
    fn build_ast_number() {
        let source = r#"
1
12.5
1e21
"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        let numbers = block
            .0
            .into_iter()
            .map(|s| {
                let exp = match_enum!(s.1, Statement::Expression { expression: e } => e);
                let op = *match_enum!(exp.1, Expression::Operand(o) => o);
                op.1
            })
            .collect::<Vec<_>>();
        assert_eq!(numbers.len(), 3);
        assert_eq!(match_enum!(numbers[0], Operand::Integer(n) => n), 1);
        assert_eq!(match_enum!(numbers[1], Operand::Float(n) => n), 12.5);
        assert_eq!(match_enum!(numbers[2], Operand::Float(n) => n), 1e21);
    }

    #[test]
    fn build_ast_string() {
        let source = r#"
""
''
"a"
"a\nb"
'a'
'a\\\n\r\tb'
'a\u1234bc'
'hey 😎'
"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        let strings: Vec<String> = block
            .0
            .into_iter()
            .map(|s| {
                let exp = match_enum!(s.1, Statement::Expression { expression: e } => e);
                let op = *match_enum!(exp.1, Expression::Operand(o) => o);
                match_enum!(op.1, Operand::String(s) => s)
            })
            .collect::<Vec<_>>();
        assert_eq!(strings.len(), 8);
        assert_eq!(strings[0], "");
        assert_eq!(strings[1], "");
        assert_eq!(strings[2], "a");
        assert_eq!(strings[3], "a\nb");
        assert_eq!(strings[4], "a");
        assert_eq!(strings[5], "a\\\n\r\tb");
        assert_eq!(strings[6], "a\u{1234}bc");
        assert_eq!(strings[7], "hey 😎");
    }

    #[test]
    fn build_ast_list_init() {
        let source = r#"
[]
[ ]
[,]
[1,]
[1, 2, 3]
[1, 2, 'abc']
[1, 2, 'abc',]
[
    1,
    2,
    'abc',
]
"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        let get_list_items = |p: &Operand| -> Vec<Operand> {
            let exps: Vec<AstPair<Expression>> =
                match_enum!(p.clone(), Operand::ListInit{items: l} => l);
            exps.into_iter()
                .map(|e| match_enum!(e.1, Expression::Operand(o) => o).1)
                .collect()
        };
        let lists = block
            .0
            .into_iter()
            .map(|s| {
                let exp = match_enum!(s.1, Statement::Expression { expression: e } => e);
                let op = *match_enum!(exp.1, Expression::Operand(o) => o);
                op.1
            })
            .collect::<Vec<_>>();
        assert_eq!(lists.len(), 8);
        assert_eq!(get_list_items(&lists[0]).len(), 0);
        assert_eq!(get_list_items(&lists[1]).len(), 0);
        assert_eq!(get_list_items(&lists[2]).len(), 0);
        assert_eq!(get_list_items(&lists[3]).len(), 1);
        assert_eq!(get_list_items(&lists[4]).len(), 3);
        assert_eq!(get_list_items(&lists[5]).len(), 3);
        assert_eq!(get_list_items(&lists[6]).len(), 3);
        assert_eq!(get_list_items(&lists[7]).len(), 3);
        let l7 = get_list_items(&lists[7]);
        assert_eq!(match_enum!(l7[0], Operand::Integer(i) => i), 1);
        assert_eq!(match_enum!(l7[1], Operand::Integer(i) => i), 2);
        assert_eq!(match_enum!(&l7[2], Operand::String(s) => s), "abc");
    }

    #[test]
    fn build_ast_struct_init() {
        let source = r#"
#{a, b, c}
#{
    a,
    b,
    c
}
"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        let get_struct_items = |p: &Operand| -> Vec<Identifier> {
            match_enum!(p.clone(), Operand::StructDefinition{fields: fs} => fs)
                .into_iter()
                .map(|a| a.1)
                .collect()
        };
        let structs = block
            .0
            .into_iter()
            .map(|s| {
                let exp = match_enum!(s.1, Statement::Expression { expression: e } => e);
                let op = *match_enum!(exp.1, Expression::Operand(o) => o);
                op.1
            })
            .collect::<Vec<_>>();
        assert_eq!(structs.len(), 2);
        assert_eq!(get_struct_items(&structs[0]).len(), 3);
        assert_eq!(get_struct_items(&structs[1]).len(), 3);
    }

    #[test]
    fn build_ast_enum_init() {
        let source = r#"
|{A, B, C}
|{
    A,
    B,
    C
}
"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block = parse_file(file).unwrap().1;
        let get_enum_items = |p: &Operand| -> Vec<Identifier> {
            match_enum!(p.clone(), Operand::EnumDefinition{values: vs} => vs)
                .into_iter()
                .map(|a| a.1)
                .collect()
        };
        let enums = block
            .0
            .into_iter()
            .map(|s| {
                let exp = match_enum!(s.1, Statement::Expression { expression: e } => e);
                let op = *match_enum!(exp.1, Expression::Operand(o) => o);
                op.1
            })
            .collect::<Vec<_>>();
        assert_eq!(enums.len(), 2);
        assert_eq!(get_enum_items(&enums[0]).len(), 3);
        assert_eq!(get_enum_items(&enums[1]).len(), 3);
    }

    #[test]
    fn build_ast_complex_expression() {
        let source = r#"a + b * c"#;
        let file = &NoisParser::parse(Rule::program, source).unwrap();
        let block: AstPair<Block> = parse_file(file).unwrap();
        let statement = block.1 .0.first().unwrap().1.clone();
        let exp = match_enum!(statement, Statement::Expression { expression: e } => e);
        let (left_op, op, right_op) = match_enum!(
            exp.1,
            Expression::Binary { left_operand: l, operator: o, right_operand: r } => (l, o, r)
        );
        assert_eq!(op.1, BinaryOperator::Add);
        let a_id = match_enum!(
            match_enum!(
                left_op.1,
                Expression::Operand(o) => o
            ).1,
            Operand::Identifier(i) => i
        );
        assert_eq!(a_id.0, "a");
        let (sub_left_op, sub_op, sub_right_op) = match_enum!(
            right_op.1,
            Expression::Binary { left_operand: l, operator: o, right_operand: r } => (l, o, r)
        );
        assert_eq!(sub_op.1, BinaryOperator::Multiply);
        let b_id = match_enum!(
            match_enum!(
                sub_left_op.1,
                Expression::Operand(o) => o
            ).1,
            Operand::Identifier(i) => i
        );
        assert_eq!(b_id.0, "b");
        let c_id = match_enum!(
            match_enum!(
                sub_right_op.1,
                Expression::Operand(o) => o
            ).1,
            Operand::Identifier(i) => i
        );
        assert_eq!(c_id.0, "c");
    }
}
