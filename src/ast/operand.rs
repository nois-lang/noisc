use crate::ast::ast_pair::AstPair;
use crate::ast::expression::Expression;
use crate::ast::function_init::FunctionInit;
use crate::ast::identifier::Identifier;
use crate::ast::value_type::ValueType;

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
