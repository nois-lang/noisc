use std::fmt::{Debug, Display, Formatter};
use std::ops;

use crate::ast::ast::FunctionInit;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Value {
    Unit,
    I(i128),
    F(f64),
    C(char),
    B(bool),
    List(Vec<Value>),
    // TODO: closures don't remember their scope
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
            Value::List(l) => {
                let all_c = !l.is_empty() && l.iter().all(|v| matches!(v, Value::C(_)));
                let is = l.into_iter().map(|i| format!("{}", i)).collect::<Vec<_>>();
                if all_c {
                    write!(f, "{}", is.join(""))
                } else {
                    write!(f, "[{}]", is.join(", "))
                }
            }
            Value::Fn(_) => write!(f, "<fn>"),
        }
    }
}

impl ops::Add for &Value {
    type Output = Result<Value, String>;

    fn add(self, rhs: Self) -> Self::Output {
        self.clone() + rhs.clone()
    }
}

impl ops::Add for Value {
    type Output = Result<Value, String>;

    fn add(self, rhs: Self) -> Self::Output {
        fn _add(a: &Value, b: &Value) -> Option<Value> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => Some(Value::I(i1 + i2)),
                (Value::F(f1), Value::F(f2)) => Some(Value::F(f1 + f2)),
                (Value::I(i1), Value::F(f2)) => Some(Value::F(*i1 as f64 + f2)),
                _ => None,
            }
        }
        match _add(&self, &rhs).or(_add(&rhs, &self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands for '+': [{:?}, {:?}]",
                self, rhs
            )),
        }
    }
}
