use std::cell::RefMut;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for AstPair<Rc<Value>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
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
mod tests {
    use crate::ast::ast::ValueType;
    use crate::interpret::interpreter::evaluate;
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

