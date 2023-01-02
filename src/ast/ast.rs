use crate::ast::util::custom_error;
use crate::parser::Rule;
use pest::error::Error;
use pest::iterators::Pair;
use std::fmt;
use std::fmt::{Debug, Display, Formatter};

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Block {
    pub statements: Vec<AstPair<Statement>>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Statement {
    Return(Option<AstPair<Expression>>),
    Assignment {
        assignee: AstPair<Assignee>,
        expression: AstPair<Expression>,
    },
    Expression(AstPair<Expression>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Expression {
    Operand(Box<AstPair<Operand>>),
    Unary {
        operator: Box<AstPair<UnaryOperator>>,
        operand: Box<AstPair<Expression>>,
    },
    Binary {
        left_operand: Box<AstPair<Expression>>,
        operator: Box<AstPair<BinaryOperator>>,
        right_operand: Box<AstPair<Expression>>,
    },
    MatchExpression {
        condition: Box<AstPair<Expression>>,
        match_clauses: Vec<AstPair<MatchClause>>,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Operand {
    Hole,
    Integer(i128),
    Float(f64),
    StructDefinition {
        fields: Vec<AstPair<Identifier>>,
    },
    EnumDefinition {
        values: Vec<AstPair<Identifier>>,
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

impl Display for UnaryOperator {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                UnaryOperator::Plus => "+",
                UnaryOperator::Minus => "-",
                UnaryOperator::Not => "!",
                UnaryOperator::Spread => "..",
            }
        )
    }
}

impl TryFrom<Pair<'_, Rule>> for UnaryOperator {
    type Error = Error<Rule>;

    fn try_from(pair: Pair<Rule>) -> Result<Self, Self::Error> {
        match pair.as_rule() {
            Rule::ADD_OP => Ok(Self::Plus),
            Rule::SUBTRACT_OP => Ok(Self::Minus),
            Rule::NOT_OP => Ok(Self::Not),
            Rule::SPREAD_OP => Ok(Self::Spread),

            _ => Err(custom_error(
                &pair,
                format!("unknown unary operator {:?}", pair.as_rule()),
            )),
        }
    }
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
    GreaterOrEquals,
    Less,
    LessOrEquals,
    And,
    Or,
}

impl Display for BinaryOperator {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                BinaryOperator::Add => "+",
                BinaryOperator::Subtract => "-",
                BinaryOperator::Multiply => "*",
                BinaryOperator::Divide => "/",
                BinaryOperator::Exponent => "^",
                BinaryOperator::Remainder => "%",
                BinaryOperator::Accessor => ".",
                BinaryOperator::Equals => "==",
                BinaryOperator::NotEquals => "!=",
                BinaryOperator::Greater => ">",
                BinaryOperator::GreaterOrEquals => ">=",
                BinaryOperator::Less => "<",
                BinaryOperator::LessOrEquals => "<=",
                BinaryOperator::And => "&&",
                BinaryOperator::Or => "||",
            }
        )
    }
}

impl TryFrom<Pair<'_, Rule>> for BinaryOperator {
    type Error = Error<Rule>;

    fn try_from(pair: Pair<Rule>) -> Result<Self, Self::Error> {
        match pair.as_rule() {
            Rule::ADD_OP => Ok(Self::Add),
            Rule::SUBTRACT_OP => Ok(Self::Subtract),
            Rule::MULTIPLY_OP => Ok(Self::Multiply),
            Rule::DIVIDE_OP => Ok(Self::Divide),
            Rule::EXPONENT_OP => Ok(Self::Exponent),
            Rule::REMAINDER_OP => Ok(Self::Remainder),
            Rule::ACCESSOR_OP => Ok(Self::Accessor),
            Rule::EQUALS_OP => Ok(Self::Equals),
            Rule::NOT_EQUALS_OP => Ok(Self::NotEquals),
            Rule::GREATER_OP => Ok(Self::Greater),
            Rule::GREATER_OR_EQUALS_OP => Ok(Self::GreaterOrEquals),
            Rule::LESS_OP => Ok(Self::Less),
            Rule::LESS_OR_EQUALS_OP => Ok(Self::LessOrEquals),
            Rule::AND_OP => Ok(Self::And),
            Rule::OR_OP => Ok(Self::Or),
            _ => Err(custom_error(
                &pair,
                format!("unknown binary operator {:?}", pair.as_rule()),
            )),
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Identifier(pub String);

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct MatchClause {
    pub predicate_expression: Box<AstPair<PredicateExpression>>,
    pub block: Box<AstPair<Block>>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PredicateExpression {
    Expression(AstPair<Expression>),
    Pattern(AstPair<Pattern>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Assignee {
    Hole,
    Identifier(AstPair<Identifier>),
    Pattern(AstPair<Pattern>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Pattern {
    Hole,
    List(Vec<AstPair<PatternItem>>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PatternItem {
    Hole,
    Identifier {
        identifier: AstPair<Identifier>,
        spread: bool,
    },
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Span {
    pub input: String,
    pub start: usize,
    pub end: usize,
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

#[derive(PartialOrd, PartialEq, Clone)]
pub struct AstPair<A>(pub Span, pub A);

impl<T: Debug> Debug for AstPair<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        if f.alternate() {
            write!(f, "{:#?}", self.1)
        } else {
            write!(f, "{:?}", self.1)
        }
    }
}
