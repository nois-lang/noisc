use std::collections::HashMap;
use std::rc::Rc;

use crate::ast::ast_pair::{AstPair, Span};
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, arg_values, run_closure, LibFunction, Package};

pub fn package() -> Package {
    let mut defs = HashMap::new();
    [
        Spread::definitions(),
        Range::definitions(),
        Len::definitions(),
        Map::definitions(),
        Filter::definitions(),
        Reduce::definitions(),
        At::definitions(),
        Slice::definitions(),
        Join::definitions(),
        Split::definitions(),
        Flat::definitions(),
        Reverse::definitions(),
        Sort::definitions(),
    ]
    .into_iter()
    .for_each(|d| defs.extend(d));
    Package {
        name: "list".to_string(),
        definitions: defs,
    }
}

pub struct Spread;

impl LibFunction for Spread {
    fn name() -> Vec<String> {
        vec!["spread".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
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
                format!("incompatible spread operand: {}", a.value_type()),
            )),
        }
    }
}

// TODO: backwards range (same as slice())
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
    fn name() -> Vec<String> {
        vec!["range".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
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
    fn name() -> Vec<String> {
        vec!["len".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let l = match arg_values(args)[..] {
            [Value::List { items: l, .. }] => l,
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
    fn name() -> Vec<String> {
        vec!["map".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let list = match arg_values(args)[..] {
            [Value::List { items: l, .. }, f] if f.is_callable() => l,
            _ => return Err(arg_error("([*], (*, I) -> *))", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        let res = list
            .iter()
            .enumerate()
            .map(|(i, li)| {
                let next = run_closure(
                    &args[1],
                    Some(Rc::new(vec![
                        args[0].with(Rc::new(li.clone())),
                        args[1].with(Rc::new(Value::I(i as i128))),
                    ])),
                    callee,
                    ctx,
                )?;

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
    fn name() -> Vec<String> {
        vec!["filter".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let list = match arg_values(args)[..] {
            [Value::List { items: l, .. }, f] if f.is_callable() => l,
            _ => return Err(arg_error("([*], (*, I) -> B)", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        let res: Vec<Value> = list
            .iter()
            .enumerate()
            .map(|(i, li)| {
                let next = run_closure(
                    &args[1],
                    Some(Rc::new(vec![
                        args[0].with(Rc::new(li.clone())),
                        args[1].with(Rc::new(Value::I(i as i128))),
                    ])),
                    callee,
                    ctx,
                )?;

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
    fn name() -> Vec<String> {
        vec!["reduce".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let (list, start) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, s, f] if f.is_callable() => (l, s),
            _ => return Err(arg_error("([a], b, (b, a, I) -> b)", args, ctx)),
        };
        let callee: Option<Span> = ctx.scope_stack.last().unwrap().callee;

        // TODO: optimize: make rc
        let mut acc = start.clone();

        list.iter()
            .enumerate()
            .map(|(i, li)| {
                let next = run_closure(
                    &args[2],
                    Some(Rc::new(vec![
                        args[2].with(Rc::new(acc.clone())),
                        args[0].with(Rc::new(li.clone())),
                        args[2].with(Rc::new(Value::I(i as i128))),
                    ])),
                    callee,
                    ctx,
                )?;

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
    fn name() -> Vec<String> {
        vec!["at".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let (list, i) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::I(i)] => (l, *i),
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
    fn name() -> Vec<String> {
        vec!["slice".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let (list, from, to) = match arg_values(args)[..] {
            [Value::List { items: l, .. }, Value::I(f), Value::I(t)] => (l, *f, *t),
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
            Err(format!("index out of bounds: {i}, size is {len}"))
        }
    } else {
        let ni = (len as i128) + i;
        if ni >= 0 {
            Ok(ni as usize)
        } else {
            Err(format!("negative index out of bounds: {ni}, size is {len}"))
        }
    }
}

pub struct Flat;

impl LibFunction for Flat {
    fn name() -> Vec<String> {
        vec!["flat".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
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
    fn name() -> Vec<String> {
        vec!["join".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
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

pub struct Split;

impl LibFunction for Split {
    fn name() -> Vec<String> {
        vec!["split".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let res = match arg_values(args)[..] {
            [Value::List { items: is, .. }, v] => is
                .split(|e| e == v)
                .into_iter()
                .map(|s| Value::list(s.to_vec()))
                .collect(),
            _ => return Err(arg_error("([*])", args, ctx)),
        };

        Ok(Value::list(res))
    }
}

pub struct Reverse;

impl LibFunction for Reverse {
    fn name() -> Vec<String> {
        vec!["reverse".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let l = match arg_values(args)[..] {
            [Value::List { items: is, .. }] => is.clone(),
            _ => return Err(arg_error("([*])", args, ctx)),
        };

        Ok(Value::list(l.iter().rev().cloned().collect()))
    }
}

pub struct Sort;

impl LibFunction for Sort {
    fn name() -> Vec<String> {
        vec!["sort".to_string()]
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut Context) -> Result<Value, Error> {
        let mut l = match arg_values(args)[..] {
            [Value::List { items: is, .. }] => is.as_ref().clone(),
            _ => return Err(arg_error("([*])", args, ctx)),
        };

        let err = l
            .windows(2)
            .map(|is| {
                is[0].partial_cmp(&is[1]).ok_or_else(|| {
                    Error::from_callee(
                        ctx,
                        format!(
                            "values are not comparable: {}, {}",
                            is[0].value_type(),
                            is[1].value_type()
                        ),
                    )
                })
            })
            .find(Result::is_err);
        if let Some(Err(e)) = err {
            return Err(e);
        }

        l.sort_by(|a, b| a.partial_cmp(b).unwrap());

        Ok(Value::list(l))
    }
}
