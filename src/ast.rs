use crate::parser::Rule;
use pest::error::{Error, ErrorVariant};
use pest::iterators::Pair;
use regex::Regex;
use std::any::Any;
use std::fmt;
use std::fmt::{Debug, Display, Formatter};

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Block(Vec<AstPair<Statement>>);

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Statement {
    Return {
        expression: Option<AstPair<Expression>>,
    },
    Assignment {
        assignee: AstPair<Assignee>,
        expression: AstPair<Expression>,
    },
    Expression {
        expression: AstPair<Expression>,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Expression {
    Operand(Box<AstPair<Operand>>),
    Unary {
        operand: Box<AstPair<Expression>>,
        operator: Box<AstPair<UnaryOperator>>,
    },
    Binary {
        left_operand: Box<AstPair<Expression>>,
        operator: Box<AstPair<BinaryOperator>>,
        right_operand: Box<AstPair<Expression>>,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Operand {
    Hole,
    Number(i128),
    MatchExpression {
        condition: Box<AstPair<Expression>>,
        match_clauses: Vec<AstPair<MatchClause>>,
    },
    StructDefinition {
        identifier: AstPair<Identifier>,
        field_identifiers: Vec<AstPair<Identifier>>,
    },
    EnumDefinition {
        identifier: AstPair<Identifier>,
        value_identifiers: Vec<AstPair<Identifier>>,
    },
    ListInit {
        items: Vec<AstPair<Expression>>,
    },
    FunctionInit {
        arguments: Vec<AstPair<Assignee>>,
        block: AstPair<Block>,
    },
    FunctionCall {
        identifier: AstPair<Identifier>,
        parameters: Vec<AstPair<Expression>>,
    },
    String(String),
    Identifier(Identifier),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum UnaryOperator {
    Plus,
    Minus,
    Not,
    Spread,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
    Exponent,
    Remainder,
    Accessor,
    Equals,
    NotEquals,
    Greater,
    Less,
    And,
    Or,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Identifier(pub String);

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct MatchClause {
    pub predicate_expression: Box<AstPair<Expression>>,
    pub expression: Box<AstPair<Expression>>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Assignee {
    Identifier(AstPair<Identifier>),
    Pattern {
        pattern_items: Vec<AstPair<PatternItem>>,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PatternItem {
    Hole,
    Identifier(AstPair<Identifier>),
    Spread(AstPair<Identifier>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Span {
    input: String,
    start: usize,
    end: usize,
}

impl<'a> From<pest::Span<'a>> for Span {
    fn from(span: pest::Span<'a>) -> Self {
        Self {
            input: span.as_str().to_string(),
            start: span.start(),
            end: span.end(),
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct AstPair<A>(Span, A);

impl<T: Debug> Display for AstPair<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        let s = format!("{:#?}", self);
        let re1 = Regex::new(r"(?mU)\n.*Span \{[\s\S]*},").unwrap();
        let no_span = re1.replace_all(s.as_str(), "");
        write!(f, "{}", no_span)
    }
}

pub fn from_pair<A>(p: &Pair<Rule>, ast: A) -> AstPair<A> {
    AstPair(p.as_span().into(), ast)
}

pub fn from_span<A>(s: &Span, ast: A) -> AstPair<A> {
    AstPair(s.clone().into(), ast)
}

pub fn children<'a>(p: &'a Pair<Rule>) -> Vec<Pair<'a, Rule>> {
    p.clone().into_inner().collect::<Vec<_>>()
}

fn custom_error(pair: &Pair<Rule>, message: String) -> Error<Rule> {
    Error::new_from_span(ErrorVariant::CustomError { message }, pair.as_span())
}

pub fn parse_block(pair: &Pair<Rule>) -> Result<AstPair<Block>, Error<Rule>> {
    match pair.as_rule() {
        Rule::block => {
            let mut statements: Vec<AstPair<Statement>> = vec![];
            for statement in children(pair).into_iter().map(|s| parse_statement(&s)) {
                match statement {
                    Ok(s) => statements.push(s),
                    Err(e) => return Err(e),
                }
            }
            Ok(from_pair(pair, Block(statements)))
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
        Rule::assignment => todo!(),
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
            let children = children(pair);
            if children.len() == 1 {
                return parse_operand(&children[0])
                    .map(|o| from_pair(pair, Expression::Operand(Box::from(o))));
            }
            todo!("other expression logic")
        }
        _ => Err(custom_error(
            pair,
            format!("expected expression, found {:?}", pair.as_rule()),
        )),
    }
}

pub fn parse_operand(pair: &Pair<Rule>) -> Result<AstPair<Operand>, Error<Rule>> {
    match pair.as_rule() {
        Rule::number => Ok(from_pair(pair, Operand::Number(42))),
        Rule::function_call => {
            let ch = children(pair);
            let identifier = parse_identifier(&ch[0]);
            if let Err(e) = identifier {
                return Err(e);
            }
            let parameter_list = parse_parameter_list(&ch[1]);
            if let Err(e) = parameter_list {
                return Err(e);
            }
            Ok(from_pair(
                pair,
                Operand::FunctionCall {
                    identifier: identifier.unwrap(),
                    parameters: parameter_list.unwrap(),
                },
            ))
        }
        Rule::function_init => {
            let ch = children(pair);
            let arguments: Result<Vec<AstPair<Assignee>>, Error<Rule>> = children(&ch[0])
                .into_iter()
                .map(|a| parse_assignee(&a))
                .collect();
            if let Err(e) = arguments {
                return Err(e);
            }
            let block = parse_block(&ch[1]);
            if let Err(e) = block {
                return Err(e);
            }
            Ok(from_pair(
                pair,
                Operand::FunctionInit {
                    arguments: arguments.unwrap(),
                    block: block.unwrap(),
                },
            ))
        }
        Rule::identifier => {
            let identifier = parse_identifier(pair);
            identifier.and_then(|i| Ok(from_span(&i.0, Operand::Identifier(i.1.clone()))))
        }
        Rule::string => Ok(from_pair(
            pair,
            Operand::String(pair.as_span().as_str().to_string()),
        )),
        _ => Err(custom_error(
            pair,
            format!("expected operand, found {:?}", pair.as_rule()),
        )),
    }
}

fn parse_identifier(pair: &Pair<Rule>) -> Result<AstPair<Identifier>, Error<Rule>> {
    match pair.as_rule() {
        Rule::identifier => Ok(from_pair(
            pair,
            Identifier(pair.as_span().as_str().to_string()),
        )),
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
            format!("expected expression, found {:?}", pair.as_rule()),
        )),
    }
}

fn parse_assignee(pair: &Pair<Rule>) -> Result<AstPair<Assignee>, Error<Rule>> {
    match pair.as_rule() {
        Rule::assignee => {
            let ch = children(pair);
            return if ch.len() == 1 && ch[0].as_rule() == Rule::pattern_item {
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
