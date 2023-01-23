use std::cell::RefMut;
use std::fmt::Debug;
use std::iter::zip;

use log::debug;

use crate::ast::ast::{Assignee, AstPair, DestructureItem, DestructureList, Identifier, Span};
use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

pub fn assign_definitions<T, F>(
    assignee: AstPair<Assignee>,
    expression: T,
    ctx: &mut RefMut<Context>,
    f: F,
) -> Result<Vec<(Identifier, Definition)>, Error>
where
    T: Evaluate + Debug,
    F: Fn(AstPair<Identifier>, T) -> Definition,
{
    match assignee.clone().1 {
        Assignee::Identifier(i) => Ok(vec![(i.clone().1, f(i, expression))]),
        Assignee::Hole => Ok(vec![]),
        Assignee::DestructureList(dl) => destructure_list(dl, expression, assignee.0, ctx),
    }
}

pub fn destructure_list<T: Evaluate + Debug>(
    destructure_list: DestructureList,
    expression: T,
    span: Span,
    ctx: &mut RefMut<Context>,
) -> Result<Vec<(Identifier, Definition)>, Error> {
    let e = expression.eval(ctx)?;
    debug!("destructuring list {:?} into {:?}", &e, &destructure_list);
    match &e.1 {
        Value::List { items: vs, .. } => {
            let spread_items = destructure_list
                .0
                .iter()
                .enumerate()
                .filter_map(|(i, id)| match &id.1 {
                    // hole identifier will be inaccessible since it's invalid identifier
                    DestructureItem::SpreadHole => Some((i, id.map(|_| Identifier::new("_")))),
                    DestructureItem::Identifier {
                        identifier,
                        spread: true,
                    } => Some((i, identifier.clone())),
                    _ => None,
                })
                .collect::<Vec<_>>();
            match spread_items.len() {
                0 => {
                    if destructure_list.0.len() == vs.len() {
                        Ok(zip(destructure_list.0, vs)
                            .map(|(i, v)| destructure_item(i, e.map(|_| v.clone()), ctx))
                            .collect::<Result<Vec<_>, _>>()?
                            .into_iter()
                            .flatten()
                            .collect::<Vec<_>>())
                    } else {
                        Err(Error::from_span(
                            &e.0,
                            &ctx.ast_context,
                            format!(
                                "incompatible deconstruction length: expected {}, got {}",
                                destructure_list.0.len(),
                                vs.len()
                            ),
                        ))
                    }
                }
                1 => destructure_with_spread(
                    span,
                    ctx,
                    destructure_list,
                    vs,
                    spread_items.first().unwrap().clone(),
                ),
                _ => Err(Error::from_span(
                    &span,
                    &ctx.ast_context,
                    format!("ambiguous spreading logic: single spread identifier allowed"),
                )),
            }
        }
        _ => Err(Error::from_span(
            &e.0,
            &ctx.ast_context,
            format!("expected [*] to deconstruct, got {:?}", e.1),
        )),
    }
}

fn destructure_item(
    destructure_item: AstPair<DestructureItem>,
    value: AstPair<Value>,
    ctx: &mut RefMut<Context>,
) -> Result<Vec<(Identifier, Definition)>, Error> {
    debug!(
        "destructuring item {:?} into {:?}",
        &value, &destructure_item
    );
    match destructure_item.1 {
        DestructureItem::Hole | DestructureItem::SpreadHole => Ok(vec![]),
        DestructureItem::Identifier { identifier, .. } => {
            Ok(vec![(identifier.1, Definition::Value(value))])
        }
        DestructureItem::List(ls) => destructure_list(ls, value.clone(), value.0, ctx),
    }
}

fn destructure_with_spread(
    span: Span,
    ctx: &mut RefMut<Context>,
    destructure_list: DestructureList,
    vs: &Vec<Value>,
    spread_item: (usize, AstPair<Identifier>),
) -> Result<Vec<(Identifier, Definition)>, Error> {
    let before_pairs = destructure_list
        .0
        .iter()
        .take(spread_item.0)
        .cloned()
        .zip(vs.iter().take(spread_item.0))
        .map(|(i, v)| destructure_item(i, AstPair::from_span(&span, v.clone()), ctx))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    let spread_value_count = vs.len() - (destructure_list.0.len() - 1);
    let spread_values = vs
        .iter()
        .skip(spread_item.0)
        .take(spread_value_count)
        .cloned()
        .collect::<Vec<_>>();
    let spread_pair = vec![(
        spread_item.1.clone().1,
        Definition::Value(AstPair::from_span(&span, Value::list(spread_values))),
    )];
    let after_pairs = destructure_list
        .0
        .iter()
        .skip(spread_item.0 + 1)
        .cloned()
        .zip(vs.iter().skip(spread_value_count + spread_item.0))
        .map(|(i, v)| destructure_item(i, AstPair::from_span(&span, v.clone()), ctx))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    Ok(vec![before_pairs, spread_pair, after_pairs]
        .into_iter()
        .flatten()
        .collect())
}
