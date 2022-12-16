use crate::parser::Rule;
use pest::error::{Error, ErrorVariant};
use pest::iterators::Pair;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Program {
    Block { statements: Vec<Statement> },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Statement {
    Return {
        expression: Option<Expression>,
    },
    Assignment {
        assignee: Assignee,
        expression: Expression,
    },
    Expression {
        expression: Expression,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Expression {
    Operand(Box<Operand>),
    Unary {
        operand: Box<Expression>,
        operator: UnaryOperator,
    },
    Binary {
        left_operand: Box<Expression>,
        operator: BinaryOperator,
        right_operand: Box<Expression>,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Operand {
    Hole,
    Number(i128),
    MatchExpression {
        condition: Box<Expression>,
        match_clauses: Vec<MatchClause>,
    },
    StructDefinition {
        identifier: Identifier,
        field_identifiers: Vec<Identifier>,
    },
    EnumDefinition {
        identifier: Identifier,
        value_identifiers: Vec<Identifier>,
    },
    ListInit {
        items: Vec<Expression>,
    },
    FunctionInit {
        arguments: Vec<Assignee>,
        statements: Vec<Statement>,
    },
    FunctionCall {
        identifier: Identifier,
        parameters: Vec<Expression>,
    },
    String(String),
    Identifier(String),
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
    pub predicate_expression: Box<Expression>,
    pub expression: Box<Expression>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Assignee {
    Identifier(Identifier),
    Pattern { pattern_items: Vec<PatternItem> },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PatternItem {
    Hole,
    Identifier(Identifier),
    Spread(Identifier),
}

pub fn parse_block(pair: &Pair<Rule>) -> Result<Program, Error<Rule>> {
    match pair.as_rule() {
        Rule::block => {
            let statements: Vec<Statement> = pair
                .clone()
                .into_inner()
                .map(|s| parse_statement(&s).unwrap())
                .collect();
            Ok(Program::Block { statements })
        }
        _ => Err(Error::new_from_span(
            ErrorVariant::CustomError {
                message: "unable to parse block".to_string(),
            },
            pair.as_span(),
        )),
    }
}

fn parse_statement(pair: &Pair<Rule>) -> Result<Statement, Error<Rule>> {
    println!("{:?}", pair.as_rule());
    match pair.as_rule() {
        Rule::return_statement => todo!(),
        Rule::assignment => todo!(),
        Rule::expression => {
            parse_expression(pair).map(|expression| Statement::Expression { expression })
        }
        _ => Err(Error::new_from_span(
            ErrorVariant::CustomError {
                message: "unable to parse statement".to_string(),
            },
            pair.as_span(),
        )),
    }
}

fn parse_expression(pair: &Pair<Rule>) -> Result<Expression, Error<Rule>> {
    match pair.as_rule() {
        Rule::expression => Ok(Expression::Operand(Box::from(Operand::Number(42)))),
        _ => Err(Error::new_from_span(
            ErrorVariant::CustomError {
                message: "unable to parse expression".to_string(),
            },
            pair.as_span(),
        )),
    }
}
