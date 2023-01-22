use std::collections::HashMap;
use std::fmt;
use std::fmt::{Debug, Display, Formatter};
use std::string::ToString;

use pest::iterators::Pair;

use crate::parser::Rule;

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
    Boolean(bool),
    StructDefinition { fields: Vec<AstPair<Identifier>> },
    EnumDefinition { values: Vec<AstPair<Identifier>> },
    ListInit { items: Vec<AstPair<Expression>> },
    FunctionInit(FunctionInit),
    String(String),
    Identifier(AstPair<Identifier>),
    ValueType(ValueType),
}

#[derive(Debug, PartialOrd, Clone, Eq, Hash)]
pub enum ValueType {
    // TODO: differentiation between unit type and unit value initialization
    Unit,
    Integer,
    Float,
    Char,
    Boolean,
    Function,
    Any,
    Type,
}

impl PartialEq for ValueType {
    fn eq(&self, other: &Self) -> bool {
        if matches!(self, Self::Any) || matches!(other, Self::Any) {
            return true;
        }
        self.to_string() == other.to_string()
    }
}

impl Display for ValueType {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                ValueType::Unit => "()".to_string(),
                ValueType::Integer => "I".to_string(),
                ValueType::Float => "F".to_string(),
                ValueType::Char => "C".to_string(),
                ValueType::Boolean => "B".to_string(),
                ValueType::Function => "Fn".to_string(),
                ValueType::Any => "*".to_string(),
                ValueType::Type => "T".to_string(),
            }
        )
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct FunctionCall {
    pub callee: AstPair<Expression>,
    pub arguments: Vec<AstPair<Expression>>,
}

impl FunctionCall {
    pub fn new_by_name(span: Span, name: &str, args: Vec<AstPair<Expression>>) -> FunctionCall {
        let exp = Expression::Operand(Box::new(AstPair(
            span,
            Operand::Identifier(AstPair(span, Identifier::new(name))),
        )));
        FunctionCall {
            callee: AstPair(span, exp),
            arguments: args,
        }
    }

    pub fn as_identifier(&self) -> Option<AstPair<Identifier>> {
        match &self.callee.1 {
            Expression::Operand(o) => match &o.1 {
                Operand::Identifier(a @ AstPair(_, Identifier(_))) => Some(a.clone()),
                _ => None,
            },
            _ => None,
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct FunctionInit {
    pub parameters: Vec<AstPair<Assignee>>,
    pub block: AstPair<Block>,
    pub closure: Vec<Identifier>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum UnaryOperator {
    Plus,
    Minus,
    Not,
    Spread,
    ArgumentList(Vec<AstPair<Expression>>),
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
                UnaryOperator::ArgumentList(..) => "()",
            }
        )
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

#[derive(Debug, PartialOrd, PartialEq, Clone, Eq, Hash)]
pub struct Identifier(pub String);

impl Identifier {
    pub fn new(name: &str) -> Identifier {
        Identifier(name.to_string())
    }
}

impl Display for Identifier {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct MatchClause {
    pub pattern: AstPair<PatternItem>,
    pub block: AstPair<Block>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum PatternItem {
    Hole,
    SpreadHole,
    Integer(i128),
    Float(f64),
    Boolean(bool),
    String(String),
    Identifier {
        identifier: AstPair<Identifier>,
        spread: bool,
    },
    PatternList(Vec<AstPair<PatternItem>>),
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Assignee {
    Hole,
    DestructureList(DestructureList),
    Identifier(AstPair<Identifier>),
}

impl Assignee {
    pub fn flatten(&self) -> Vec<AstPair<Identifier>> {
        match self {
            Assignee::Hole => vec![],
            Assignee::DestructureList(DestructureList(is)) => {
                is.into_iter().flat_map(|di| di.1.flatten()).collect()
            }
            Assignee::Identifier(i) => vec![i.clone()],
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct DestructureList(pub Vec<AstPair<DestructureItem>>);

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum DestructureItem {
    Hole,
    SpreadHole,
    Identifier {
        identifier: AstPair<Identifier>,
        spread: bool,
    },
    List(DestructureList),
}

impl DestructureItem {
    pub fn flatten(&self) -> Vec<AstPair<Identifier>> {
        match self {
            DestructureItem::Hole => vec![],
            DestructureItem::SpreadHole => vec![],
            DestructureItem::Identifier { identifier: i, .. } => vec![i.clone()],
            DestructureItem::List(DestructureList(is)) => {
                is.into_iter().flat_map(|di| di.1.flatten()).collect()
            }
        }
    }
}

#[derive(Debug, PartialEq, Clone)]
pub struct AstContext {
    pub input: String,
    pub scope_stack: Vec<AstScope>,
}

impl AstContext {
    pub fn new(input: String) -> AstContext {
        AstContext {
            input,
            scope_stack: vec![AstScope::new()],
        }
    }
}

#[derive(Debug, PartialEq, Clone)]
pub struct AstScope {
    pub definitions: HashMap<Identifier, Span>,
    pub usage: HashMap<Identifier, Span>,
}

impl AstScope {
    pub fn new() -> AstScope {
        AstScope {
            definitions: HashMap::new(),
            usage: HashMap::new(),
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone, Copy)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn as_span<'a>(&self, ctx: &'a AstContext) -> pest::Span<'a> {
        pest::Span::new(&ctx.input, self.start, self.end)
            .expect(format!("failed to convert {:?}", self).as_str())
    }
}

impl<'a> From<pest::Span<'a>> for Span {
    fn from(span: pest::Span<'a>) -> Self {
        Self {
            start: span.start(),
            end: span.end(),
        }
    }
}

#[derive(PartialOrd, PartialEq, Clone)]
pub struct AstPair<A>(pub Span, pub A);

impl<A> AstPair<A> {
    pub fn from_pair(p: &Pair<Rule>, ast: A) -> AstPair<A> {
        AstPair(p.as_span().into(), ast)
    }

    pub fn from_span(s: &Span, ast: A) -> AstPair<A> {
        AstPair(s.clone(), ast)
    }

    pub fn map<T, F>(&self, f: F) -> AstPair<T>
    where
        F: Fn(&A) -> T,
    {
        let t = f(&(self).1);
        AstPair((&self.0).clone(), t)
    }

    pub fn flat_map<T, E, F>(&self, f: F) -> Result<AstPair<T>, E>
    where
        F: Fn(&A) -> Result<T, E>,
    {
        let r = f(&self.1);
        r.map(|t| AstPair((&self.0).clone(), t))
    }
}

impl<T: Debug> Debug for AstPair<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        Debug::fmt(&self.1, f)
    }
}
