use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fmt::{Debug, Display, Formatter};
use std::hash::{Hash, Hasher};
use std::ops;
use std::rc::Rc;

use log::debug;
use num::NumCast;

use crate::ast::ast_pair::AstPair;
use crate::ast::function_init::FunctionInit;
use crate::ast::identifier::Identifier;
use crate::ast::matcher::PatternItem;
use crate::ast::unary_operator::UnaryOperator;
use crate::ast::value_type::ValueType;
use crate::error::Error;
use crate::interpret::context::{Context, SysFunction};
use crate::interpret::definition::Definition;
use crate::interpret::evaluate::Evaluate;

#[derive(Clone)]
pub enum Value {
    Unit,
    I(i128),
    F(f64),
    C(char),
    B(bool),
    List { items: Rc<Vec<Value>>, spread: bool },
    // closures use context "snapshot" for evaluation
    Fn(Rc<FunctionInit>),
    Closure(Rc<FunctionInit>, HashMap<Identifier, Definition>),
    System(SysFunction),
    Type(ValueType),
}

impl Value {
    pub fn is_callable(&self) -> bool {
        matches!(self, Value::Closure(..) | Value::Fn(..) | Value::System(..))
    }

    pub fn value_type(&self) -> Value {
        let vt = match self {
            Value::Unit => ValueType::Unit,
            Value::I(_) => ValueType::Integer,
            Value::F(_) => ValueType::Float,
            Value::C(_) => ValueType::Char,
            Value::B(_) => ValueType::Boolean,
            Value::Fn(..) | Value::Closure(..) | Value::System(..) => ValueType::Function,
            Value::Type(_) => ValueType::Type,
            Value::List { items, .. } => {
                let items = {
                    if items.is_empty() {
                        vec![Value::Type(ValueType::Any)]
                    } else {
                        let types: Vec<Value> = items.iter().map(|v| v.value_type()).collect();
                        if types.iter().collect::<HashSet<_>>().len() == 1 {
                            vec![types.into_iter().next().unwrap()]
                        } else {
                            types
                        }
                    }
                };
                return Value::List {
                    items: Rc::new(items),
                    spread: false,
                };
            }
        };
        Value::Type(vt)
    }

    pub fn to(&self, vt: &Value) -> Option<Self> {
        let arg_type = self.value_type();
        if &arg_type == vt {
            return Some(self.clone());
        }
        match (self, vt) {
            // cast to [C]
            (arg, Value::List { items, .. }) => match items.first().unwrap() {
                Value::Type(t) => {
                    let str = match t {
                        ValueType::Char => match arg {
                            Value::I(a) => Some(format!("{a}")),
                            Value::F(a) => Some(format!("{a}")),
                            Value::C(a) => Some(format!("{a}")),
                            _ => None,
                        },
                        _ => None,
                    };
                    str.map(|s| Value::List {
                        items: Rc::new(s.chars().into_iter().map(Value::C).collect()),
                        spread: false,
                    })
                }
                _ => None,
            },
            (arg, Value::Type(t)) => match (arg, t) {
                // cast from [C]
                (Value::List { .. }, t)
                    if arg_type
                        == Value::List {
                            items: Rc::new(vec![Value::Type(ValueType::Char)]),
                            spread: false,
                        } =>
                {
                    let s = arg.to_string();
                    match t {
                        ValueType::Unit => Some(Value::Unit),
                        ValueType::Integer => s.parse().map(Value::I).ok(),
                        ValueType::Float => s.parse().map(Value::F).ok(),
                        ValueType::Char => s.parse().map(Value::C).ok(),
                        ValueType::Boolean => match s.as_str() {
                            "True" => Some(Value::B(true)),
                            "False" => Some(Value::B(false)),
                            _ => None,
                        },
                        _ => None,
                    }
                }
                // mono-type casts
                _ => match (arg, t) {
                    (Value::I(i), ValueType::Float) => <f64 as NumCast>::from(*i).map(Value::F),
                    (Value::F(f), ValueType::Integer) => <i128 as NumCast>::from(*f).map(Value::I),
                    (Value::I(i), ValueType::Char) => <u32 as NumCast>::from(*i)
                        .and_then(|u| char::try_from(u).map(Value::C).ok()),
                    (Value::C(c), ValueType::Integer) => {
                        <u32>::try_from(*c).ok().map(|u| Value::I(u as i128))
                    }
                    _ => None,
                },
            },
            (_, _) => None,
        }
    }

    pub fn list(vec: Vec<Value>) -> Value {
        Self::List {
            items: Rc::new(vec),
            spread: false,
        }
    }

    pub fn and(&self, rhs: &Self) -> Result<Value, String> {
        match (self, rhs) {
            (Value::B(b1), Value::B(b2)) => Ok(Value::B(*b1 && *b2)),
            _ => Err(format!(
                "incompatible operands: {} && {}",
                self.value_type(),
                rhs.value_type()
            )),
        }
    }

    pub fn or(&self, rhs: &Self) -> Result<Value, String> {
        match (self, rhs) {
            (Value::B(b1), Value::B(b2)) => Ok(Value::B(*b1 || *b2)),
            _ => Err(format!(
                "incompatible operands: {} || {}",
                self.value_type(),
                rhs.value_type()
            )),
        }
    }
}

impl Hash for Value {
    fn hash<H: Hasher>(&self, state: &mut H) {
        format!("{self:?}").hash(state);
    }
}

impl PartialEq for Value {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Type(ValueType::Any), Self::Type(_) | Self::List { .. }) => true,
            (Self::Type(_) | Self::List { .. }, Self::Type(ValueType::Any)) => true,
            (Self::Type(a), Self::Type(b)) => a == b,
            (
                Self::List {
                    items: ia,
                    spread: sa,
                },
                Self::List {
                    items: ib,
                    spread: sb,
                },
            ) => ia.as_ref() == ib.as_ref() && sa == sb,
            (Self::Fn(a), Self::Fn(b)) => a == b,
            (Self::Closure(a, _), Self::Closure(b, _)) => a == b,
            (Value::Unit, Value::Unit) => true,
            (Value::I(i1), Value::I(i2)) => i1 == i2,
            (Value::F(f1), Value::F(f2)) => f1 == f2,
            (Value::I(i1), Value::F(f2)) => (*i1 as f64) == *f2,
            (Value::F(f1), Value::I(i2)) => *f1 == (*i2 as f64),
            (Value::C(c1), Value::C(c2)) => c1 == c2,
            (Value::B(b1), Value::B(b2)) => b1 == b2,
            _ => false,
        }
    }
}

impl Eq for Value {}

impl PartialOrd for Value {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        fn _cmp(a: &Value, b: &Value) -> Option<Ordering> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => i1.partial_cmp(i2),
                (Value::F(f1), Value::F(f2)) => f1.partial_cmp(f2),
                (Value::I(i1), Value::F(f2)) => (*i1 as f64).partial_cmp(f2),
                (Value::C(c1), Value::C(c2)) => c1.partial_cmp(c2),
                (Value::B(b1), Value::B(b2)) => b1.partial_cmp(b2),
                (Value::List { items: l1, .. }, Value::List { items: l2, .. }) => {
                    l1.as_ref().partial_cmp(l2.as_ref())
                }
                _ => None,
            }
        }
        _cmp(self, other).or_else(|| _cmp(other, self))
    }
}

impl Debug for Value {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match &self {
            Value::List { items: l, spread } => {
                let all_c = !l.is_empty() && l.iter().all(|v| matches!(v, Value::C(_)));
                let is = l.iter().map(|i| format!("{i:?}")).collect::<Vec<_>>();
                let spread_s = if *spread {
                    UnaryOperator::Spread.to_string()
                } else {
                    "".to_string()
                };
                if all_c && !*spread {
                    write!(f, "'{}'", is.join(""))
                } else {
                    write!(f, "{}[{}]", spread_s, is.join(", "))
                }
            }
            Value::Unit => write!(f, "()"),
            Value::Fn(fun) => write!(f, "{fun:?}"),
            Value::Closure(fun, _) => write!(f, "{fun:?}"),
            Value::System(fun) => write!(f, "{fun:?}"),
            v => write!(f, "{v}"),
        }
    }
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
                let is = l.iter().map(|i| i.to_string()).collect::<Vec<_>>();
                if all_c && !*spread {
                    write!(f, "{}", is.join(""))
                } else {
                    write!(f, "[{}]", is.join(", "))
                }
            }
            Value::Fn(..) => write!(f, "<fn>"),
            Value::Closure(..) => write!(f, "<closure>"),
            Value::System(..) => write!(f, "<system>"),
            Value::Type(vt) => write!(f, "{vt}"),
        }
    }
}

impl TryFrom<&AstPair<PatternItem>> for Value {
    type Error = String;

    fn try_from(a: &AstPair<PatternItem>) -> Result<Self, Self::Error> {
        match &a.1 {
            PatternItem::Integer(i) => Ok(Value::I(*i)),
            PatternItem::Float(f) => Ok(Value::F(*f)),
            PatternItem::Boolean(b) => Ok(Value::B(*b)),
            PatternItem::String(s) => Ok(Value::List {
                items: Rc::new(s.chars().map(Value::C).collect()),
                spread: false,
            }),
            _ => Err(format!(
                "unable to convert pattern item {:?} into value",
                a.1
            )),
        }
    }
}

impl ops::Add for &Value {
    type Output = Result<Value, String>;

    fn add(self, rhs: Self) -> Self::Output {
        fn push_end(a: &[Value], b: &Value) -> Value {
            Value::List {
                items: Rc::new(
                    a.iter()
                        .cloned()
                        .chain(vec![b.clone()].into_iter())
                        .collect(),
                ),
                spread: false,
            }
        }
        fn push_start(a: &Value, b: &[Value]) -> Value {
            Value::List {
                items: Rc::new(vec![a].into_iter().chain(b.iter()).cloned().collect()),
                spread: false,
            }
        }
        fn _add(a: &Value, b: &Value) -> Option<Value> {
            match (a, b) {
                (Value::I(i1), Value::I(i2)) => Some(Value::I(i1 + i2)),
                (Value::F(f1), Value::F(f2)) => Some(Value::F(f1 + f2)),
                (Value::I(i1), Value::F(f2)) => Some(Value::F(*i1 as f64 + f2)),
                (
                    Value::List {
                        items: l1,
                        spread: s1,
                    },
                    Value::List {
                        items: l2,
                        spread: s2,
                    },
                ) => match (s1, s2) {
                    _ if s1 == s2 => Some(Value::List {
                        items: Rc::new(
                            l1.as_ref()
                                .iter()
                                .chain(l2.as_ref().iter())
                                .cloned()
                                .collect(),
                        ),
                        spread: false,
                    }),
                    (true, false) => Some(push_end(l1, b)),
                    (false, true) => Some(push_start(a, l2)),
                    _ => unreachable!(),
                },
                (Value::List { items: l1, .. }, _) => Some(push_end(l1, b)),
                (_, Value::List { items: l2, .. }) => Some(push_start(a, l2)),
                _ => None,
            }
        }
        match _add(self, rhs).or_else(|| _add(rhs, self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands: {} + {}",
                self.value_type(),
                rhs.value_type()
            )),
        }
    }
}

impl ops::Sub for &Value {
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
        match _sub(self, rhs).or_else(|| _sub(rhs, self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands: {} - {}",
                self.value_type(),
                rhs.value_type()
            )),
        }
    }
}

impl ops::Rem for &Value {
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
        match _rem(self, rhs).or_else(|| _rem(rhs, self)) {
            Some(r) => Ok(r),
            None => Err(format!(
                "incompatible operands: {} % {}",
                self.value_type(),
                rhs.value_type()
            )),
        }
    }
}

impl ops::Neg for &Value {
    type Output = Result<Value, String>;

    fn neg(self) -> Self::Output {
        match self {
            Value::I(i) => Ok(Value::I(-*i)),
            Value::F(f) => Ok(Value::F(-*f)),
            Value::B(_) => Err(format!(
                "incompatible operands: -{}, use !",
                self.value_type()
            )),
            op => Err(format!("incompatible operands: -{}", op.value_type())),
        }
    }
}

impl ops::Not for &Value {
    type Output = Result<Value, String>;

    fn not(self) -> Self::Output {
        match self {
            Value::B(b) => Ok(Value::B(!*b)),
            op => Err(format!("incompatible operands: !{}", op.value_type())),
        }
    }
}

impl Evaluate for AstPair<Rc<Value>> {
    fn eval(self, ctx: &mut Context) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval value {:?}", &self);
        if let Some(args) = ctx
            .scope_stack
            .last()
            .unwrap()
            .arguments
            .as_ref()
            .map(Rc::clone)
        {
            match self.1.as_ref() {
                Value::Fn(f) => {
                    debug!("eval function {:?}", f);
                    self.with(Rc::clone(f)).eval(ctx)
                }
                Value::Closure(f, defs) => {
                    debug!("eval closure {:?}", f);
                    debug!("extending scope with captured definitions: {:?}", defs);
                    ctx.scope_stack
                        .last_mut()
                        .unwrap()
                        .definitions
                        .extend(defs.clone());
                    self.with(Rc::clone(f)).eval(ctx)
                }
                Value::System(sf) => {
                    debug!("eval system function");
                    sf.0(args.as_ref(), ctx).map(|a| a.map(|v| Rc::new(v.clone())))
                }
                _ => Ok(self),
            }
        } else {
            Ok(self)
        }
    }
}

#[cfg(test)]
mod test {
    use crate::ast::value_type::ValueType;
    use crate::interpret::interpreter::test::evaluate;
    use crate::interpret::value::Value;

    #[test]
    fn evaluate_literals() {
        assert_eq!(evaluate(""), Ok(Value::Unit));
        assert_eq!(evaluate("4"), Ok(Value::I(4)));
        assert_eq!(evaluate("4.56"), Ok(Value::F(4.56)));
        assert_eq!(evaluate("1e12"), Ok(Value::F(1e12)));
        assert_eq!(evaluate("'a'").map(|r| r.to_string()), Ok("a".to_string()));
        assert_eq!(evaluate("[]"), Ok(Value::list(vec![])));
        assert_eq!(
            evaluate("[1, 2]"),
            Ok(Value::list(vec![Value::I(1), Value::I(2)]))
        );
        assert_eq!(
            evaluate("'ab'"),
            Ok(Value::list(vec![Value::C('a'), Value::C('b')]))
        );
        assert_eq!(
            evaluate("[1, 'b']"),
            Ok(Value::list(vec![
                Value::I(1),
                Value::list(vec![Value::C('b')]),
            ]))
        );
        assert!(matches!(evaluate("a -> a"), Ok(Value::Fn(..))));
        assert_eq!(
            evaluate("[C]"),
            Ok(Value::list(vec![Value::Type(ValueType::Char)]))
        );
    }

    #[test]
    fn evaluate_value_equality() {
        assert_eq!(evaluate("1 == 1"), Ok(Value::B(true)));
        assert_eq!(evaluate("'foo' == 'foo'"), Ok(Value::B(true)));
        assert_eq!(evaluate("'' == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == []"), Ok(Value::B(true)));
        assert_eq!(evaluate("() == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("f = a -> {}\n f == f"), Ok(Value::B(true)));

        assert_eq!(evaluate("(a -> {}) == (a -> {})"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == 2"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == '1'"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == [1]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_value_type() {
        assert_eq!(evaluate("type(1)"), Ok(Value::Type(ValueType::Integer)));
        assert_eq!(evaluate("type(1.5)"), Ok(Value::Type(ValueType::Float)));
        assert_eq!(evaluate("type(True)"), Ok(Value::Type(ValueType::Boolean)));
        assert_eq!(
            evaluate("type([])"),
            Ok(Value::list(vec![Value::Type(ValueType::Any)]))
        );
        assert_eq!(
            evaluate("type('')"),
            Ok(Value::list(vec![Value::Type(ValueType::Any)]))
        );
        assert_eq!(
            evaluate("type('abc')"),
            Ok(Value::list(vec![Value::Type(ValueType::Char)]))
        );
        assert_eq!(evaluate("type(-> 1)"), Ok(Value::Type(ValueType::Function)));
        assert_eq!(
            evaluate("type([1, 2, 3])"),
            Ok(Value::list(vec![Value::Type(ValueType::Integer)]))
        );
        assert_eq!(
            evaluate("type([1, 'abc', 1.5])"),
            Ok(Value::list(vec![
                Value::Type(ValueType::Integer),
                Value::list(vec![Value::Type(ValueType::Char)]),
                Value::Type(ValueType::Float),
            ],))
        );
        assert_eq!(evaluate("type(C)"), Ok(Value::Type(ValueType::Type)));
        assert_eq!(
            evaluate("type(['abc'])"),
            Ok(Value::list(vec![Value::list(vec![Value::Type(
                ValueType::Char
            )])]))
        );
    }

    #[test]
    fn evaluate_value_type_equality() {
        assert_eq!(evaluate("type(1) == I"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([]) == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('') == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('a') == [C]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type(['a']) == [[C]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([[]]) == [[*]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("* == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("I == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == [*]"), Ok(Value::B(true)));

        assert_eq!(evaluate("type(1) == C"), Ok(Value::B(false)));
        assert_eq!(evaluate("type('a') == [I]"), Ok(Value::B(false)));
        assert_eq!(evaluate("type(['a']) == [C]"), Ok(Value::B(false)));
        assert_eq!(evaluate("[C] == [[*]]"), Ok(Value::B(false)));
        assert_eq!(evaluate("I == [*]"), Ok(Value::B(false)));
    }
}
