use std::collections::HashMap;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::ast::binary_operator::BinaryOperator;
use crate::ast::unary_operator::UnaryOperator;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_values, LibFunction, Package};

pub fn package() -> Package {
    let mut defs = HashMap::new();
    [
        Add::definitions(),
        Sub::definitions(),
        Mul::definitions(),
        Div::definitions(),
        Exp::definitions(),
        Rem::definitions(),
        Eq::definitions(),
        Ne::definitions(),
        Gt::definitions(),
        Ge::definitions(),
        Lt::definitions(),
        Le::definitions(),
        Not::definitions(),
        And::definitions(),
        Or::definitions(),
    ]
    .into_iter()
    .for_each(|d| defs.extend(d));
    Package {
        name: "math".to_string(),
        definitions: defs,
    }
}

pub struct Add;

impl LibFunction for Add {
    fn name() -> Vec<String> {
        vec!["add".to_string(), BinaryOperator::Add.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (args[0].1.as_ref() + args[1].1.as_ref()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Sub;

impl LibFunction for Sub {
    fn name() -> Vec<String> {
        vec!["sub".to_string(), BinaryOperator::Subtract.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        match arg_values(args)[..] {
            [a, b] => a - b,
            [a] => -a,
            _ => unreachable!(),
        }
        .map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Mul;

impl LibFunction for Mul {
    fn name() -> Vec<String> {
        vec!["mul".to_string(), BinaryOperator::Multiply.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (args[0].1.as_ref() * args[1].1.as_ref()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Div;

impl LibFunction for Div {
    fn name() -> Vec<String> {
        vec!["div".to_string(), BinaryOperator::Divide.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (args[0].1.as_ref() / args[1].1.as_ref()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Exp;

impl LibFunction for Exp {
    fn name() -> Vec<String> {
        vec!["exp".to_string(), BinaryOperator::Exponent.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (args[0].1.as_ref().exp(args[1].1.as_ref())).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Rem;

impl LibFunction for Rem {
    fn name() -> Vec<String> {
        vec!["rem".to_string(), BinaryOperator::Remainder.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (args[0].1.as_ref() % args[1].1.as_ref()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Eq;

impl LibFunction for Eq {
    fn name() -> Vec<String> {
        vec!["eq".to_string(), BinaryOperator::Equals.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1 == args[1].1))
    }
}

pub struct Ne;

impl LibFunction for Ne {
    fn name() -> Vec<String> {
        vec!["ne".to_string(), BinaryOperator::NotEquals.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1 != args[1].1))
    }
}

pub struct Gt;

impl LibFunction for Gt {
    fn name() -> Vec<String> {
        vec!["gt".to_string(), BinaryOperator::Greater.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1.as_ref() > args[1].1.as_ref()))
    }
}

pub struct Ge;

impl LibFunction for Ge {
    fn name() -> Vec<String> {
        vec![
            "ge".to_string(),
            BinaryOperator::GreaterOrEquals.to_string(),
        ]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1.as_ref() >= args[1].1.as_ref()))
    }
}

pub struct Lt;

impl LibFunction for Lt {
    fn name() -> Vec<String> {
        vec!["lt".to_string(), BinaryOperator::Less.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1.as_ref() < args[1].1.as_ref()))
    }
}

pub struct Le;

impl LibFunction for Le {
    fn name() -> Vec<String> {
        vec!["le".to_string(), BinaryOperator::LessOrEquals.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
        Ok(Value::B(args[0].1.as_ref() <= args[1].1.as_ref()))
    }
}

pub struct Not;

impl LibFunction for Not {
    fn name() -> Vec<String> {
        vec!["not".to_string(), UnaryOperator::Not.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        (!args[0].1.as_ref()).map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct And;

impl LibFunction for And {
    fn name() -> Vec<String> {
        vec!["and".to_string(), BinaryOperator::And.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        args[0]
            .1
            .and(args[1].1.as_ref())
            .map_err(|s| Error::from_callee(ctx, s))
    }
}

pub struct Or;

impl LibFunction for Or {
    fn name() -> Vec<String> {
        vec!["or".to_string(), BinaryOperator::Or.to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        args[0]
            .1
            .or(args[1].1.as_ref())
            .map_err(|s| Error::from_callee(ctx, s))
    }
}
