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
