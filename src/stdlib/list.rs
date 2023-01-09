use std::cell::RefMut;
use std::collections::HashMap;

use log::debug;

use crate::ast::ast::{AstPair, Span};
use crate::error::Error;
use crate::interpret::context::{Context, Scope};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "list".to_string(),
        definitions: HashMap::from([Range::definition(), Map::definition(), Filter::definition()]),
    }
}

/// Generate a list of integers in specified range
///
///     range(I, I) -> [I]    from inclusive, to exclusive
///     range(I)    -> [I]    to exclusive
///
/// Examples:
///
///     range(2) -> [0, 1]
///     range(10, 15) -> [10, 11, 12, 13, 14]
///
pub struct Range;

impl LibFunction for Range {
    fn name() -> String {
        "range".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let range = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [Value::I(s)] => 0..*s,
            [Value::I(s), Value::I(e)] => *s..*e,
            _ => return Err(arg_error("(I, I?)", args, ctx)),
        };
        Ok(Value::List {
            items: range.map(|i| Value::I(i)).collect::<Vec<_>>(),
            spread: false,
        })
    }
}

// TODO: element index as second argument
/// Convert one list to another calling function on each item
///
///     map([*], (*) -> *) -> [*]
///
/// Examples:
///
///     map([1, 2, 3], e -> e + 1) -> [2, 3, 4]
///
pub struct Map;

impl LibFunction for Map {
    fn name() -> String {
        "map".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let list = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [Value::List { items: l, .. }, Value::Fn(..)] => l.clone(),
            _ => return Err(arg_error("([*], Fn)", args, ctx)),
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
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Value::List {
            items: res,
            spread: false,
        })
    }
}

// TODO: element index as second argument
/// Filter a list by predicate function
///
///     filter([*], (*) -> B) -> [*]
///
/// Examples:
///
///     filter([1, 2, 3], e -> e != 2) -> [1, 3]
///
pub struct Filter;

impl LibFunction for Filter {
    fn name() -> String {
        "filter".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let list = match &args.into_iter().map(|a| a.1.clone()).collect::<Vec<_>>()[..] {
            [Value::List { items: l, .. }, Value::Fn(..)] => l.clone(),
            _ => return Err(arg_error("([*], Fn)", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee.clone();

        let res: Vec<Value> = list
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

                let b = match next.1 {
                    Value::B(b) => Ok(b),
                    v => Err(Error::from_callee(
                        ctx,
                        format!("Expected B, found {}", v.value_type()),
                    )),
                }?;
                Ok((li, b))
            })
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter_map(|(i, f)| if f { Some(i) } else { None })
            .collect();

        Ok(Value::List {
            items: res,
            spread: false,
        })
    }
}
