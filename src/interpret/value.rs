use std::fmt::{Debug, Display, Formatter};
use std::ops;

use crate::ast::ast::{AstPair, FunctionInit, PatternItem, UnaryOperator};

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Value {
    Unit,
    I(i128),
    F(f64),
    C(char),
    B(bool),
    List { items: Vec<Value>, spread: bool },
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
            Value::List { items: l, spread } => {
                let all_c = !l.is_empty() && l.iter().all(|v| matches!(v, Value::C(_)));
                let is = l.into_iter().map(|i| format!("{}", i)).collect::<Vec<_>>();
                let spread_s = if *spread {
                    UnaryOperator::Spread.to_string()
                } else {
                    "".to_string()
                };
                if all_c && !*spread {
                    write!(f, "{}", is.join(""))
                } else {
                    write!(f, "{}[{}]", spread_s, is.join(", "))
                }
            }
            Value::Fn(_) => write!(f, "<fn>"),
        }
    }
}

impl TryFrom<AstPair<PatternItem>> for Value {
    type Error = String;

    fn try_from(a: AstPair<PatternItem>) -> Result<Self, Self::Error> {
        match a.1 {
            PatternItem::Integer(i) => Ok(Value::I(i)),
            PatternItem::Float(f) => Ok(Value::F(f)),
            PatternItem::Boolean(b) => Ok(Value::B(b)),
            PatternItem::String(s) => Ok(Value::List {
                items: s.chars().map(|c| Value::C(c)).collect(),
                spread: false,
            }),
            _ => Err(format!(
                "Unable to convert pattern item {:?} into value",
                a.1
            )),
        }
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
                // TODO: list push & concat
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

impl ops::Sub for Value {
    type Output = Result<Value, String>;

    fn sub(self, rhs: Self) -> Self::Output {
        fn _sub(a: &Value, b: &Value) -> Option<Value> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => Some(Value::I(i1 - i2)),
                (Value::F(f1), Value::F(f2)) => Some(Value::F(f1 - f2)),
                (Value::I(i1), Value::F(f2)) => Some(Value::F(*i1 as f64 - f2)),
                _ => None,
            }
        }
        match _sub(&self, &rhs).or(_sub(&rhs, &self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands for '-': [{:?}, {:?}]",
                self, rhs
            )),
        }
    }
}

impl ops::Rem for Value {
    type Output = Result<Value, String>;

    fn rem(self, rhs: Self) -> Self::Output {
        fn _rem(a: &Value, b: &Value) -> Option<Value> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => Some(Value::I(i1 % i2)),
                (Value::F(f1), Value::F(f2)) => Some(Value::F(f1 % f2)),
                (Value::I(i1), Value::F(f2)) => Some(Value::F(*i1 as f64 % f2)),
                _ => None,
            }
        }
        match _rem(&self, &rhs).or(_rem(&rhs, &self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands for '-': [{:?}, {:?}]",
                self, rhs
            )),
        }
    }
}
