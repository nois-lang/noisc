use std::cell::RefMut;
use std::collections::HashMap;

use log::debug;

use crate::ast::ast::{AstPair, Span};
use crate::error::Error;
use crate::interpret::context::{Context, Scope};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "list".to_string(),
        definitions: HashMap::from([Range::definition(), Map::definition()]),
    }
}

pub struct Range;

impl LibFunction for Range {
    fn name() -> String {
        "range".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let range = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [Value::I(s)] => 0..*s,
            [Value::I(s), Value::I(e)] => *s..*e,
            l => {
                return Err(Error::from_callee(
                    ctx,
                    format!("Expected (I, I?), found {:?}", l),
                ));
            }
        };
        Ok(Value::List {
            items: range.map(|i| Value::I(i)).collect::<Vec<_>>(),
            spread: false,
        })
    }
}

pub struct Map;

impl LibFunction for Map {
    fn name() -> String {
        "map".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let list = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [Value::List { items: l, .. }, Value::Fn(..)] => l.clone(),
            l => {
                return Err(Error::from_callee(
                    ctx,
                    format!("Expected (List, Fn), found {:?}", l),
                ));
            }
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee.clone();

        let res = list
            .into_iter()
            .map(|li| {
                ctx.scope_stack.push(
                    Scope::new("<closure>".to_string())
                        .with_callee(callee.clone())
                        .with_arguments(vec![args[0].map(|_| li.clone())]),
                );
                debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

                let next = args[1].eval(ctx, true).map_err(|e| e)?;

                debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                ctx.scope_stack.pop();

                Ok(next.1)
            })
            .collect::<Result<Vec<_>, _>>();

        res.map(|l| Value::List {
            items: l,
            spread: false,
        })
    }
}
