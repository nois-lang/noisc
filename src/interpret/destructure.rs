use std::fmt::Debug;
use std::iter::zip;
use std::rc::Rc;

use log::debug;

use crate::ast::ast_pair::{AstPair, Span};
use crate::ast::destructure::{Assignee, DestructureItem, DestructureList};
use crate::ast::identifier::Identifier;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::definition::Definition;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

#[derive(Debug, Clone)]
pub struct AssignmentPair(pub Identifier, pub Definition);

impl AssignmentPair {
    pub fn into_tuple(self) -> (Identifier, Definition) {
        (self.0, self.1)
    }
}

#[derive(Debug, Clone, Default)]
pub struct AssignmentResult {
    pub pairs: Vec<AssignmentPair>,
    pub is_destructured: bool,
}

impl AssignmentResult {
    pub fn destructured(pairs: Vec<AssignmentPair>) -> AssignmentResult {
        AssignmentResult {
            pairs,
            is_destructured: true,
        }
    }
}

pub fn assign_definitions<T, F>(
    assignee: &AstPair<Assignee>,
    expression: T,
    ctx: &mut Context,
    f: F,
) -> Result<AssignmentResult, Error>
where
    T: Evaluate + Debug,
    F: Fn(AstPair<Identifier>, T) -> Definition,
{
    match &assignee.1 {
        Assignee::Identifier(i) => Ok(AssignmentResult {
            pairs: vec![AssignmentPair(i.1.clone(), f(i.clone(), expression))],
            is_destructured: false,
        }),
        Assignee::Hole => Ok(AssignmentResult {
            pairs: vec![],
            is_destructured: true,
        }),
        Assignee::DestructureList(dl) => {
            destructure_list(dl, expression, assignee.0, ctx).map(AssignmentResult::destructured)
        }
    }
}

pub fn destructure_list<T: Evaluate + Debug>(
    destructure_list: &DestructureList,
    expression: T,
    span: Span,
    ctx: &mut Context,
) -> Result<Vec<AssignmentPair>, Error> {
    let e = expression.eval(ctx)?;
    debug!("destructuring list {:?} into {:?}", &e, destructure_list);
    match e.1.as_ref() {
        Value::List { items: vs, .. } => {
            let spread_items = destructure_list
                .0
                .iter()
                .enumerate()
                .filter_map(|(i, id)| match &id.1 {
                    // hole identifier will be inaccessible since it's invalid identifier
                    DestructureItem::SpreadHole => Some((i, id.with(Identifier::new("_")))),
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
                        Ok(zip(&destructure_list.0, vs.as_ref())
                            .map(|(i, v)| destructure_item(i, e.with(Rc::new(v.clone())), ctx))
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
                    spread_items.first().unwrap(),
                ),
                _ => Err(Error::from_span(
                    &span,
                    &ctx.ast_context,
                    "ambiguous spreading logic: single spread identifier allowed".to_string(),
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
    destructure_item: &AstPair<DestructureItem>,
    value: AstPair<Rc<Value>>,
    ctx: &mut Context,
) -> Result<Vec<AssignmentPair>, Error> {
    debug!(
        "destructuring item {:?} into {:?}",
        &value, &destructure_item
    );
    match &destructure_item.1 {
        DestructureItem::Hole | DestructureItem::SpreadHole => Ok(vec![]),
        DestructureItem::Identifier { identifier, .. } => {
            let pair = AssignmentPair(identifier.1.clone(), Definition::Value(value));
            Ok(vec![pair])
        }
        DestructureItem::List(ls) => {
            let s = value.0;
            destructure_list(ls, value, s, ctx)
        }
    }
}

fn destructure_with_spread(
    span: Span,
    ctx: &mut Context,
    destructure_list: &DestructureList,
    vs: &[Value],
    spread_item: &(usize, AstPair<Identifier>),
) -> Result<Vec<AssignmentPair>, Error> {
    let before_pairs = destructure_list
        .0
        .iter()
        .take(spread_item.0)
        .zip(vs.iter().take(spread_item.0))
        .map(|(i, v)| destructure_item(i, AstPair::from_span(&span, Rc::new(v.clone())), ctx))
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
    let spread_pair = vec![AssignmentPair(
        spread_item.1 .1.clone(),
        Definition::Value(AstPair::from_span(
            &span,
            Rc::new(Value::list(spread_values)),
        )),
    )];
    let after_pairs = destructure_list
        .0
        .iter()
        .skip(spread_item.0 + 1)
        .zip(vs.iter().skip(spread_value_count + spread_item.0))
        .map(|(i, v)| destructure_item(i, AstPair::from_span(&span, Rc::new(v.clone())), ctx))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    let pairs = vec![before_pairs, spread_pair, after_pairs]
        .into_iter()
        .flatten()
        .collect();
    Ok(pairs)
}

#[cfg(test)]
mod test {
    use crate::interpret::interpreter::test::evaluate;
    use crate::interpret::value::Value;

    #[test]
    fn evaluate_assignee_basic() {
        assert_eq!(evaluate("a = 4\na"), Ok(Value::I(4)));
        assert_eq!(evaluate("_ = 4"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, b] = [1, 2]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[a, b] = [1, 2]\nb"), Ok(Value::I(2)));
        assert_eq!(evaluate("[a, b] = [1, 2, 3]\na").is_err(), true);
        assert_eq!(evaluate("[a, _, c] = [1, 2, 3]\nc"), Ok(Value::I(3)));
        assert_eq!(
            evaluate("[_, [c, _]] = [[1, 2], [3, 4]]\nc"),
            Ok(Value::I(3))
        );
    }

    #[test]
    fn evaluate_assignee_spread_hole() {
        assert_eq!(evaluate("[..] = [1, 2, 3]"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, ..] = [1, 2, 3]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[.., a] = [1, 2, 3]\na"), Ok(Value::I(3)));
        assert_eq!(evaluate("[_, a, ..] = [1, 2, 3]\na"), Ok(Value::I(2)));
        assert_eq!(evaluate("[_, a, ..] = range(100)\na"), Ok(Value::I(1)));
    }
}
