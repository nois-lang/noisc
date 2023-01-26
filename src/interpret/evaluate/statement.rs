use crate::ast::ast_pair::AstPair;
use crate::ast::statement::Statement;
use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::destructure::{assign_definitions, AssignmentPair, AssignmentResult};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use log::debug;
use std::cell::RefMut;
use std::rc::Rc;

impl Evaluate for AstPair<Rc<Statement>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        let unit = Ok(self.with(Rc::new(Value::Unit)));
        debug!("eval {:?}", &self);
        match self.1.as_ref() {
            Statement::Expression(exp) => exp.map(Rc::clone).eval(ctx),
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs = assign_definitions(
                    assignee,
                    expression.map(|v| Rc::new(v.clone())),
                    ctx,
                    Definition::User,
                )?;
                debug!("assignment defs: {:?}", defs);
                match defs {
                    AssignmentResult {
                        ref pairs,
                        is_destructured: false,
                    } if !pairs.is_empty() && ctx.find_definition_mut(&pairs[0].0).is_some() => {
                        let ap = pairs.iter().next().unwrap();
                        let r = ap.1.clone().eval(ctx)?;
                        debug!("found prev defined id, reassign to {:?}", &ap);
                        *ctx.find_definition_mut(&pairs[0].0).unwrap() = Definition::Value(r);
                    }
                    _ => {
                        debug!("new assignment: {:?}", defs);
                        let scope = ctx.scope_stack.last_mut().unwrap();
                        scope
                            .definitions
                            .extend(defs.pairs.into_iter().map(AssignmentPair::into_tuple));
                    }
                };
                unit
            }
            Statement::Return(v) => {
                let return_value = match v {
                    Some(a) => a.map(|v| Rc::new(v.clone())).eval(ctx)?.1,
                    None => Rc::new(Value::Unit),
                };
                debug!("return value: {:?}", &return_value);
                ctx.scope_stack.last_mut().unwrap().return_value = Some(return_value);
                unit
            }
        }
    }
}

#[cfg(test)]
mod tests {}
