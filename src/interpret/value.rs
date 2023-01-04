use crate::ast::ast::FunctionInit;
use colored::Colorize;
use std::fmt::{Debug, Display, Formatter};
use std::ops;
use std::process::exit;

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
            Value::B(b) => write!(f, "{}", if *b { "True" } else { "False" }),
            // TODO: general list repr
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

impl ops::Add for &Value {
    type Output = Value;

    fn add(self, rhs: Self) -> Value {
        fn _add(a: &Value, b: &Value) -> Option<Value> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => Some(Value::I(i1 + i2)),
                (Value::F(f1), Value::F(f2)) => Some(Value::F(f1 + f2)),
                (Value::I(i1), Value::F(f2)) => Some(Value::F(*i1 as f64 + f2)),
                _ => None,
            }
        }
        match _add(self, rhs).or(_add(rhs, self)) {
            Some(r) => r,
            None => {
                eprintln!(
                    "{}",
                    format!("incompatible operands for '+': [{:?}, {:?}]", self, rhs).red()
                );
                exit(1)
            }
        }
    }
}
