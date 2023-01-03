use crate::ast::ast::FunctionInit;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Value {
    Unit,
    I(i128),
    F(f64),
    // TODO: booleans
    C(char),
    B(bool),
    List(Vec<Value>),
    Fn(Box<FunctionInit>),
}
