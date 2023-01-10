use std::cell::RefMut;
use std::fmt::Debug;
use std::iter::zip;

use log::debug;

use crate::ast::ast::{Assignee, AstPair, DestructureItem, DestructureList, Identifier};
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
        Assignee::DestructureList(dl) => destructure_list(dl, expression, ctx),
    }
}

pub fn destructure_list<T: Evaluate + Debug>(
    destructure_list: DestructureList,
    expression: T,
    ctx: &mut RefMut<Context>,
) -> Result<Vec<(Identifier, Definition)>, Error> {
    let e = expression.eval(ctx, true)?;
    debug!("destructuring list {:?} into {:?}", &e, &destructure_list);
    match &e.1 {
        Value::List { items: vs, .. } => {
            if let DestructureItem::Identifier { spread: true, .. } =
                &destructure_list.0.first().unwrap().1
            {
                todo!("spread destructuring")
            } else if let DestructureItem::Identifier { spread: true, .. } =
                &destructure_list.0.last().unwrap().1
            {
                todo!("spread destructuring")
            } else {
                if destructure_list.0.len() == vs.len() {
                    let a = zip(destructure_list.0, vs)
                        .map(|(i, v)| destructure_item(i, e.map(|_| v.clone()), ctx))
                        .collect::<Result<Vec<_>, _>>()?
                        .into_iter()
                        .flatten()
                        .collect::<Vec<_>>();
                    Ok(a)
                } else {
                    return Err(Error::from_span(
                        &e.0,
                        &ctx.ast_context,
                        format!(
                            "incompatible deconstruction length: expected {}, got {}",
                            destructure_list.0.len(),
                            vs.len()
                        ),
                    ));
                }
            }
        }
        _ => Err(Error::from_span(
            &e.0,
            &ctx.ast_context,
            format!("expected [*] to deconstruct, got {:?}", e.1),
        )),
    }
}

pub fn destructure_item(
    destructure_item: AstPair<DestructureItem>,
    value: AstPair<Value>,
    ctx: &mut RefMut<Context>,
) -> Result<Vec<(Identifier, Definition)>, Error> {
    debug!(
        "destructuring item {:?} into {:?}",
        &value, &destructure_item
    );
    match destructure_item.1 {
        DestructureItem::Hole => Ok(vec![]),
        DestructureItem::Identifier { identifier, .. } => {
            Ok(vec![(identifier.1, Definition::Value(value))])
        }
        DestructureItem::List(ls) => destructure_list(ls, value, ctx),
    }
}
