use std::collections::HashMap;
use std::fmt;
use std::fmt::{Debug, Display, Formatter};
use std::hash::{Hash, Hasher};
use std::rc::Rc;
use std::string::ToString;

use pest::iterators::Pair;

use crate::parser::Rule;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Block {
    pub statements: Vec<AstPair<Rc<Statement>>>,
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Statement {
    Return(Option<AstPair<Expression>>),
    Assignment {
        assignee: AstPair<Assignee>,
        expression: AstPair<Expression>,
    },
    Expression(AstPair<Rc<Expression>>),
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

#[derive(Debug, PartialOrd, Clone, Eq)]
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

impl Hash for ValueType {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.to_string().hash(state);
    }
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
    pub callee: AstPair<Rc<Expression>>,
    pub arguments: Vec<AstPair<Rc<Expression>>>,
}

impl FunctionCall {
    pub fn new_by_name(span: Span, name: &str, args: Vec<AstPair<Rc<Expression>>>) -> FunctionCall {
        let exp = Expression::Operand(Box::new(AstPair(
            span,
            Operand::Identifier(AstPair(span, Identifier::new(name))),
        )));
        FunctionCall {
            callee: AstPair(span, Rc::new(exp)),
            arguments: args,
        }
    }

    pub fn as_identifier(&self) -> Option<&AstPair<Identifier>> {
        match self.callee.1.as_ref() {
            Expression::Operand(o) => match &o.1 {
                Operand::Identifier(a @ AstPair(_, Identifier(_))) => Some(a),
                _ => None,
            },
            _ => None,
        }
    }
}

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct FunctionInit {
    pub parameters: Vec<AstPair<Assignee>>,
    pub block: AstPair<Rc<Block>>,
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

#[derive(Debug, PartialOrd, PartialEq, Eq, Clone)]
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
                is.iter().flat_map(|di| di.1.flatten()).collect()
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
                is.iter().flat_map(|di| di.1.flatten()).collect()
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AstContext {
    pub input: String,
    pub global_scope: AstScope,
    pub scope_stack: Vec<AstScope>,
}

impl AstContext {
    pub fn definitions(&self) -> HashMap<Identifier, Option<Span>> {
        let mut defs = HashMap::new();
        for s in &self.scope_stack {
            defs.extend(s.definitions.clone())
        }
        defs
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Default)]
pub struct AstScope {
    pub definitions: HashMap<Identifier, Option<Span>>,
    pub usage: HashMap<Identifier, Span>,
}

impl AstScope {
    /// Get used identifiers that are not provided by the map
    pub fn external(
        self,
        definitions: &HashMap<Identifier, Option<Span>>,
    ) -> HashMap<Identifier, Span> {
        self.usage
            .into_iter()
            .filter(|(i, _)| !definitions.contains_key(i))
            .collect()
    }
}

#[derive(Debug, PartialOrd, PartialEq, Eq, Clone, Copy)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn as_span<'a>(&self, ctx: &'a AstContext) -> pest::Span<'a> {
        pest::Span::new(&ctx.input, self.start, self.end)
            .unwrap_or_else(|| panic!("failed to convert {:?}", self))
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

#[derive(PartialOrd, PartialEq, Eq, Clone)]
pub struct AstPair<A>(pub Span, pub A);

impl<A> AstPair<A> {
    pub fn from_pair(p: &Pair<Rule>, ast: A) -> AstPair<A> {
        AstPair(p.as_span().into(), ast)
    }

    pub fn from_span(s: &Span, ast: A) -> AstPair<A> {
        AstPair(*s, ast)
    }

    pub fn map<T, F>(&self, f: F) -> AstPair<T>
    where
        F: FnOnce(&A) -> T,
    {
        let t = f(&self.1);
        AstPair(self.0, t)
    }

    pub fn map_into<T, F>(self, f: F) -> AstPair<T>
    where
        F: FnOnce(A) -> T,
    {
        let t = f(self.1);
        AstPair(self.0, t)
    }

    pub fn with<T>(&self, t: T) -> AstPair<T> {
        AstPair(self.0, t)
    }

    pub fn flat_map<T, E, F>(&self, f: F) -> Result<AstPair<T>, E>
    where
        F: Fn(&A) -> Result<T, E>,
    {
        let r = f(&self.1);
        r.map(|t| AstPair(self.0, t))
    }

    pub fn as_ref(&self) -> AstPair<&A> {
        AstPair(self.0, &self.1)
    }
}

impl<A> AstPair<&A> {
    pub fn cloned(&self) -> AstPair<A>
    where
        A: Clone,
    {
        AstPair(self.0, (self.1).clone())
    }
}

impl<T: Debug> Debug for AstPair<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        Debug::fmt(&self.1, f)
    }
}
