use crate::ast::ast::FunctionInit;
use std::fmt::{Debug, Display, Formatter};

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

impl Display for Value {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match &self {
            Value::Unit => write!(f, "()"),
            Value::I(i) => write!(f, "{i}"),
            Value::F(fl) => write!(f, "{fl}"),
            Value::C(c) => write!(f, "{c}"),
            Value::B(b) => write!(f, "{b}"),
            Value::List(l) => write!(
                f,
                "{}",
                l.into_iter()
                    .map(|i| format!("{}", i))
                    .collect::<Vec<_>>()
                    .join("")
            ),
            Value::Fn(_) => write!(f, "<fn>"),
        }
    }
}
