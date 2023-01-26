use std::cell::RefMut;
use std::iter::zip;
use std::ops::Deref;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::ast::expression::Expression;
use crate::ast::identifier::Identifier;
use crate::ast::matcher::{MatchClause, PatternItem};
use log::debug;

use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

pub fn match_expression(
    expression: &AstPair<Rc<Expression>>,
    ctx: &mut RefMut<Context>,
) -> Result<Option<(AstPair<MatchClause>, Vec<(Identifier, Definition)>)>, Error> {
    match expression.1.as_ref() {
        Expression::MatchExpression {
            condition,
            match_clauses,
        } => {
            let value = condition.deref().map(|v| Rc::new(v.clone())).eval(ctx)?;
            for (i, clause) in match_clauses.iter().enumerate() {
                debug!("matching {:?} against {:?}", value, clause);
                let p_match = match_pattern_item(&value, &clause.1.pattern, ctx)?;
                if let Some(pm) = p_match {
                    debug!("matched pattern #{i}: {:?}", clause.1);
                    return Ok(Some((clause.clone(), pm)));
                }
            }
            Ok(None)
        }
        _ => unreachable!(),
    }
}

pub fn match_pattern_item(
    value: &AstPair<Rc<Value>>,
    pattern_item: &AstPair<PatternItem>,
    ctx: &mut RefMut<Context>,
) -> Result<Option<Vec<(Identifier, Definition)>>, Error> {
    let defs = match &pattern_item.1 {
        PatternItem::Hole | PatternItem::SpreadHole => Some(vec![]),
        PatternItem::Integer(_)
        | PatternItem::Float(_)
        | PatternItem::Boolean(_)
        | PatternItem::String(_) => Value::try_from(pattern_item)
            .map_err(|e| Error::from_span(&pattern_item.0, &ctx.ast_context, e))?
            .eq(&value.1)
            .then_some(vec![]),
        PatternItem::Identifier {
            identifier: id,
            spread: false,
        } => Some(vec![(id.1.clone(), Definition::Value(value.clone()))]),
        PatternItem::Identifier {
            identifier: _,
            spread: true,
        } => {
            return Err(Error::from_span(
                &pattern_item.0,
                &ctx.ast_context,
                "unexpected spread operator".to_string(),
            ));
        }
        PatternItem::PatternList(items) => {
            return match value.1.as_ref() {
                Value::List { items: vs, .. } => {
                    let spread_items = items
                        .iter()
                        .enumerate()
                        .filter_map(|(i, id)| match &id.1 {
                            // hole identifier will be inaccessible since it's invalid identifier
                            PatternItem::SpreadHole => Some((i, id.with(Identifier::new("_")))),
                            PatternItem::Identifier {
                                identifier,
                                spread: true,
                            } => Some((i, identifier.clone())),
                            _ => None,
                        })
                        .collect::<Vec<_>>();
                    match spread_items.len() {
                        0 => match_list(value, ctx, items, vs),
                        1 => match_list_with_spread(
                            value,
                            ctx,
                            items,
                            vs,
                            spread_items.into_iter().next().unwrap(),
                        ),
                        _ => Err(Error::from_span(
                            &pattern_item.0,
                            &ctx.ast_context,
                            "ambiguous spreading logic: single spread identifier allowed"
                                .to_string(),
                        )),
                    }
                }
                _ => Err(Error::from_span(
                    &value.0,
                    &ctx.ast_context,
                    format!("expected [*] to deconstruct, got {:?}", value.1),
                )),
            };
        }
    };
    Ok(defs)
}

fn match_list(
    value: &AstPair<Rc<Value>>,
    ctx: &mut RefMut<Context>,
    items: &[AstPair<PatternItem>],
    vs: &[Value],
) -> Result<Option<Vec<(Identifier, Definition)>>, Error> {
    if items.len() == vs.len() {
        Ok(zip(items, vs)
            .map(|(i, v)| match_pattern_item(&value.with(Rc::new(v.clone())), i, ctx))
            .collect::<Result<Option<Vec<_>>, _>>()?
            .map(|o| o.into_iter().flatten().collect::<Vec<_>>()))
    } else {
        Err(Error::from_span(
            &value.0,
            &ctx.ast_context,
            format!(
                "incompatible deconstruction length: expected {}, got {}",
                items.len(),
                vs.len()
            ),
        ))
    }
}

fn match_list_with_spread(
    value: &AstPair<Rc<Value>>,
    ctx: &mut RefMut<Context>,
    items: &[AstPair<PatternItem>],
    vs: &[Value],
    spread_item: (usize, AstPair<Identifier>),
) -> Result<Option<Vec<(Identifier, Definition)>>, Error> {
    let before_pairs = items
        .iter()
        .take(spread_item.0)
        .zip(vs.iter().take(spread_item.0))
        .map(|(i, v)| match_pattern_item(&value.with(Rc::new(v.clone())), i, ctx))
        .collect::<Result<Option<Vec<_>>, _>>()?
        .map(|o| o.into_iter().flatten().collect::<Vec<_>>());
    let spread_value_count = vs.len() - (items.len() - 1);
    let spread_values = vs
        .iter()
        .skip(spread_item.0)
        .take(spread_value_count)
        .cloned()
        .collect::<Vec<_>>();
    let spread_pair = Some(vec![(
        spread_item.1 .1,
        Definition::Value(value.with(Rc::new(Value::list(spread_values)))),
    )]);
    let after_pairs = items
        .iter()
        .skip(spread_item.0 + 1)
        .zip(vs.iter().skip(spread_value_count + spread_item.0))
        .map(|(i, v)| match_pattern_item(&value.with(Rc::new(v.clone())), i, ctx))
        .collect::<Result<Option<Vec<_>>, _>>()?
        .map(|o| o.into_iter().flatten().collect::<Vec<_>>());
    Ok(vec![before_pairs, spread_pair, after_pairs]
        .into_iter()
        .collect::<Option<Vec<_>>>()
        .map(|l| l.into_iter().flatten().collect()))
}

#[cfg(test)]
mod tests {
    use crate::interpret::interpreter::evaluate;
    use crate::interpret::value::Value;

    #[test]
    fn evaluate_match_spread_hole() {
        assert_eq!(evaluate("match [1, 2, 3] { [..] => 5 }"), Ok(Value::I(5)));
        assert_eq!(
            evaluate("match [1, 2, 3] { [a, ..] => a }"),
            Ok(Value::I(1))
        );
        assert_eq!(
            evaluate("match range(100) { [_, .., a] => a }"),
            Ok(Value::I(99))
        );
    }
}
