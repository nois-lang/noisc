use std::cell::RefMut;
use std::collections::HashMap;
use std::mem::take;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::{AstPair, Span};
use crate::error::Error;
use crate::interpret::context::{Context, Scope};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, arg_values, LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "list".to_string(),
        definitions: HashMap::from([
            Spread::definition(),
            Range::definition(),
            Len::definition(),
            Map::definition(),
            Filter::definition(),
            Reduce::definition(),
            At::definition(),
            Slice::definition(),
            Join::definition(),
            Flat::definition(),
            Reverse::definition(),
        ]),
    }
}

pub struct Spread;

impl LibFunction for Spread {
    fn name() -> String {
        "spread".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let arg = &args[0];
        match arg.1.as_ref() {
            Value::List { items: l, spread } => {
                if *spread {
                    Err(Error::from_callee(
                        ctx,
                        format!("list is already spread {}", arg.1),
                    ))
                } else {
                    Ok(Value::List {
                        items: Rc::clone(l),
                        spread: true,
                    })
                }
            }
            a => Err(Error::from_callee(
                ctx,
                format!("incompatible operand: {}{}", Self::name(), a.value_type()),
            )),
        }
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

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let range = match arg_values(args)[..] {
            [Value::I(s)] => 0..*s,
            [Value::I(s), Value::I(e)] => *s..*e,
            _ => return Err(arg_error("(I, I?)", args, ctx)),
        };
        Ok(Value::list(range.map(Value::I).collect::<Vec<_>>()))
    }
}

/// Return list length
///
///     len([*]) -> I
///
/// Examples:
///
///     len([]) -> 0
///     len([1, 2, 3]) -> 3
///
pub struct Len;

impl LibFunction for Len {
    fn name() -> String {
        "len".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let l = match arg_values(args)[..] {
            [Value::List { items: l, .. }] => l.clone(),
            _ => return Err(arg_error("([*])", args, ctx)),
        };
        Ok(Value::I(l.len() as i128))
    }
}

/// Convert one list to another calling function on each item and its index
///
///     map([*], (*, I) -> *) -> [*]
///
/// Examples:
///
///     map([1, 2, 3], e -> e + 1) -> [2, 3, 4]
///     map([1, 2, 3], (_, i) -> i) -> [0, 1, 2]
///
pub struct Map;

impl LibFunction for Map {
    fn name() -> String {
        "map".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let list = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::Closure(..) | Value::Fn(..)] => l.clone(),
            _ => return Err(arg_error("([*], (*, I) -> *))", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        let res = list
            .iter()
            .enumerate()
            .map(|(i, li)| {
                // TODO: refactor to a common method of calling a closure from sys function
                ctx.scope_stack.push(take(
                    Scope::new("<closure>".to_string())
                        .with_callee(callee)
                        .with_arguments(Some(vec![
                            args[0].with(Rc::new(li.clone())),
                            args[1].with(Rc::new(Value::I(i as i128))),
                        ])),
                ));
                debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

                let next = args[1].clone().eval(ctx)?;

                debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                ctx.scope_stack.pop();

                Ok(next.1.as_ref().clone())
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Value::list(res))
    }
}

/// Filter a list by predicate function on each item and its index
///
///     filter([*], (*, I) -> B) -> [*]
///
/// Examples:
///
///     filter([1, 2, 3], e -> e != 2) -> [1, 3]
///     filter([1, 2, 3], (_, i) -> i == 1) -> [2]
///
pub struct Filter;

impl LibFunction for Filter {
    fn name() -> String {
        "filter".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let list = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::Closure(..) | Value::Fn(..)] => l.clone(),
            _ => return Err(arg_error("([*], (*, I) -> B)", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        let res: Vec<Value> = list
            .iter()
            .enumerate()
            .map(|(i, li)| {
                ctx.scope_stack.push(take(
                    Scope::new("<closure>".to_string())
                        .with_callee(callee)
                        .with_arguments(Some(vec![
                            args[0].with(Rc::new(li.clone())),
                            args[1].with(Rc::new(Value::I(i as i128))),
                        ])),
                ));
                debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

                let next = args[1].clone().eval(ctx)?;

                debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                ctx.scope_stack.pop();

                let b = match next.1.as_ref() {
                    Value::B(b) => Ok(b),
                    v => Err(Error::from_callee(
                        ctx,
                        format!("expected B, found {}", v.value_type()),
                    )),
                }?;
                Ok((li, *b))
            })
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter_map(|(i, f)| if f { Some(i) } else { None })
            .cloned()
            .collect();

        Ok(Value::list(res))
    }
}

/// Transform list into a single accumulated value with reducing function
///
///     reduce([a], b, (b, a, I) -> b) -> b
///
pub struct Reduce;

impl LibFunction for Reduce {
    fn name() -> String {
        "reduce".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let (list, start) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, s, Value::Closure(..) | Value::Fn(..)] => {
                (Rc::clone(l), s)
            }
            _ => return Err(arg_error("([a], b, (b, a, I) -> b)", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        // TODO: optimize: make rc
        let mut acc = start.clone();

        list.iter()
            .enumerate()
            .map(|(i, li)| {
                ctx.scope_stack.push(take(
                    Scope::new("<closure>".to_string())
                        .with_callee(callee)
                        .with_arguments(Some(vec![
                            args[2].with(Rc::new(acc.clone())),
                            args[0].with(Rc::new(li.clone())),
                            args[2].with(Rc::new(Value::I(i as i128))),
                        ])),
                ));
                debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

                let next = args[2].clone().eval(ctx)?;

                debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                ctx.scope_stack.pop();

                acc = next.1.as_ref().clone();
                Ok(acc.clone())
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(acc)
    }
}

/// Access element by index, error if not found.
/// Negative index counts from the end
/// Invalid index panics
///
///     at([*], I) -> *
///
/// Examples:
///
///     at([1, 2, 3], 0) -> 1
///     at([1, 2, 3], 2) -> 3
///     at([1, 2, 3], -1) -> 3
///     at([1, 2, 3], 100) -> panic
///
pub struct At;

impl LibFunction for At {
    fn name() -> String {
        "at".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let (list, i) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::I(i)] => (Rc::clone(l), *i),
            _ => return Err(arg_error("([*], I)", args, ctx)),
        };

        match from_relative_index(i, list.len()) {
            Ok(idx) => Ok(list[idx].clone()),
            Err(e) => Err(Error::from_callee(ctx, e)),
        }
    }
}

/// Take part of list specified by start (inclusive) and end (inclusive)
/// Negative indices count from the end
/// If end is greater than start take in reverse
/// Any invalid index panics
///
///     slice([*], I, I) -> [*]
///
/// Examples
///
///     slice([1, 2, 3], 0, 2) -> [1, 2, 3]
///     slice([1, 2, 3], 1, 2) -> [2, 3]
///     slice([1, 2, 3], 2, 2) -> [3]
///     slice([1, 2, 3], 2, 0) -> [3, 2, 1]
///     slice([1, 2, 3], 0, -1) -> [1, 2, 3]
///     slice([1, 2, 3], 0, 3) -> !
///     slice([1, 2, 3], -4, 0) -> !
///
pub struct Slice;

impl LibFunction for Slice {
    fn name() -> String {
        "slice".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let (list, from, to) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::I(f), Value::I(t)] => (l.clone(), *f, *t),
            _ => return Err(arg_error("([*], I, I)", args, ctx)),
        };

        match (
            from_relative_index(from, list.len()),
            from_relative_index(to, list.len()),
        ) {
            (Ok(f), Ok(t)) if f <= t => Ok(Value::list(list.as_slice()[f..=t].to_vec())),
            (Ok(f), Ok(t)) => Ok(Value::list(
                list.as_slice()[t..=f]
                    .iter()
                    .rev()
                    .cloned()
                    .collect::<Vec<_>>(),
            )),
            (Err(e), _) | (_, Err(e)) => Err(Error::from_callee(ctx, e)),
        }
    }
}

pub fn from_relative_index(i: i128, len: usize) -> Result<usize, String> {
    if i >= 0 {
        if i < len as i128 {
            Ok(i as usize)
        } else {
            Err(format!("index out of bounds: {}, size is {}", i, len))
        }
    } else {
        let ni = (len as i128) + i;
        if ni >= 0 {
            Ok(ni as usize)
        } else {
            Err(format!(
                "negative index out of bounds: {}, size is {}",
                ni, len
            ))
        }
    }
}

pub struct Flat;

impl LibFunction for Flat {
    fn name() -> String {
        "flat".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let res = match arg_values(args)[..] {
            [Value::List { items: is, .. }] => {
                let l = is
                    .iter()
                    .map(|i| match i {
                        Value::List { items: l, .. } => Some(l.as_ref()),
                        _ => None,
                    })
                    .collect::<Option<Vec<_>>>()
                    .ok_or_else(|| arg_error("([[*]])", args, ctx))?;
                l.into_iter().flatten().cloned().collect()
            }
            _ => return Err(arg_error("([[*]])", args, ctx)),
        };

        Ok(Value::list(res))
    }
}

pub struct Join;

impl LibFunction for Join {
    fn name() -> String {
        "join".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let res = match arg_values(args)[..] {
            [Value::List { items: is, .. }, v] => itertools::intersperse(is.iter(), v)
                .cloned()
                .collect::<Vec<_>>(),
            [Value::List { items: is, .. }] => is.as_ref().clone(),
            _ => return Err(arg_error("([*], *?)", args, ctx)),
        };

        Ok(Value::list(res))
    }
}

pub struct Reverse;

impl LibFunction for Reverse {
    fn name() -> String {
        "reverse".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        let l = match arg_values(args)[..] {
            [Value::List { items: is, .. }] => is.clone(),
            _ => return Err(arg_error("([*])", args, ctx)),
        };

        Ok(Value::list(l.iter().rev().cloned().collect()))
    }
}
