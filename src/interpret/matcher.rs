use std::cell::RefMut;
use std::fmt::Debug;
use std::iter::zip;

use log::debug;

use crate::ast::ast::{
    Assignee, AstPair, DestructureItem, DestructureList, Expression, Identifier, MatchClause,
    PatternItem,
};
use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

pub fn match_expression(
    expression: AstPair<Expression>,
    ctx: &mut RefMut<Context>,
) -> Result<Option<(AstPair<MatchClause>, Vec<(Identifier, Definition)>)>, Error> {
    match expression.1 {
        Expression::MatchExpression {
            condition,
            match_clauses,
        } => {
            let value = condition.eval(ctx, true)?;
            for (i, clause) in match_clauses.into_iter().enumerate() {
                debug!("matching {:?} against {:?}", &value, &clause);
                let p_match = match_pattern_item(value.clone(), clause.1.pattern.clone(), ctx)?;
                if let Some(pm) = p_match {
                    debug!("matched pattern #{i}: {:?}", clause.1);
                    return Ok(Some((clause, pm)));
                }
            }
            return Ok(None);
        }
        _ => unreachable!(),
    }
}

pub fn match_pattern_item(
    value: AstPair<Value>,
    pattern_item: AstPair<PatternItem>,
    ctx: &mut RefMut<Context>,
) -> Result<Option<Vec<(Identifier, Definition)>>, Error> {
    let defs = match pattern_item.1 {
        PatternItem::Hole => Some(vec![]),
        PatternItem::Integer(_)
        | PatternItem::Float(_)
        | PatternItem::Boolean(_)
        | PatternItem::String(_) => Value::try_from(pattern_item.clone())
            .map_err(|e| Error::from_span(&pattern_item.0, &ctx.ast_context, e))?
            .eq(&value.1)
            .then(|| vec![]),
        PatternItem::Identifier {
            identifier: id,
            spread: false,
        } => Some(vec![(id.1, Definition::Value(value))]),
        PatternItem::Identifier {
            identifier: _,
            spread: true,
        } => todo!("spread matching"),
        PatternItem::PatternList(items) => match &value.1 {
            Value::List { items: vs, .. } => {
                if let PatternItem::Identifier { spread: true, .. } = &items.first().unwrap().1 {
                    todo!("spread matching")
                } else if let PatternItem::Identifier { spread: true, .. } =
                    &items.last().unwrap().1
                {
                    todo!("spread matching")
                } else {
                    if items.len() == vs.len() {
                        zip(items, vs)
                            .map(|(i, v)| match_pattern_item(value.map(|_| v.clone()), i, ctx))
                            .collect::<Result<Option<Vec<_>>, _>>()?
                            .map(|o| o.into_iter().flatten().collect::<Vec<_>>())
                    } else {
                        return Err(Error::from_span(
                            &value.0,
                            &ctx.ast_context,
                            format!(
                                "Incompatible deconstruction length: expected {}, got {}",
                                items.len(),
                                vs.len()
                            ),
                        ));
                    }
                }
            }
            _ => {
                return Err(Error::from_span(
                    &value.0,
                    &ctx.ast_context,
                    format!("Expected List to deconstruct, got {:?}", value.1),
                ));
            }
        },
    };
    Ok(defs)
}

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
                        .iter()
                        .flatten()
                        .cloned()
                        .collect::<Vec<_>>();
                    Ok(a)
                } else {
                    return Err(Error::from_span(
                        &e.0,
                        &ctx.ast_context,
                        format!(
                            "Incompatible deconstruction length: expected {}, got {}",
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
            format!("Expected List to deconstruct, got {:?}", e.1),
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
        DestructureItem::Identifier {
            identifier,
            spread: false,
        } => Ok(vec![(identifier.1, Definition::Value(value))]),
        DestructureItem::Identifier {
            identifier: _,
            spread: true,
        } => {
            todo!("spread destructuring")
        }
        DestructureItem::List(ls) => destructure_list(ls, value, ctx),
    }
}
