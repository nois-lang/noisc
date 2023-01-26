use std::cell::RefMut;
use std::rc::Rc;

use log::debug;

use crate::ast::ast_pair::AstPair;
use crate::ast::function_init::FunctionInit;
use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::destructure::{assign_definitions, AssignmentPair};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for AstPair<Rc<FunctionInit>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", self);
        // if scope has args, this is a function call and function init must be evaluated
        if let Some(args) = ctx
            .scope_stack
            .last()
            .unwrap()
            .arguments
            .as_ref()
            .map(Rc::clone)
        {
            debug!("function init args: {:?}", args);
            for (param, v) in self.1.parameters.iter().zip(args.iter()) {
                let defs =
                    assign_definitions(param, v.map(Rc::clone), ctx, |_, e| Definition::Value(e))?;
                ctx.scope_stack
                    .last_mut()
                    .unwrap()
                    .definitions
                    .extend(defs.pairs.into_iter().map(AssignmentPair::into_tuple));
            }

            let s = ctx.scope_stack.last().unwrap();
            debug!("consuming scope @{} arguments: {:?}", s.name, s.arguments);
            debug!("function init scope @{}: {:?}", s.name, s.definitions);

            ctx.scope_stack.last_mut().unwrap().arguments = None;
            self.1.block.map(Rc::clone).eval(ctx)
        } else {
            let closure = &self.1.closure;
            let v = if closure.is_empty() {
                Value::Fn(self.1)
            } else {
                let defs = closure
                    .iter()
                    .cloned()
                    .map(|i| {
                        let def = ctx.find_definition(&i).unwrap_or_else(|| {
                            panic!("identifier {} not found: (required for closure)", i)
                        });
                        Ok((i, def.clone()))
                    })
                    .collect::<Result<_, _>>()?;
                debug!("lazy init function with context snapshot {:?}", &ctx);
                Value::Closure(self.1, defs)
            };
            Ok(AstPair::from_span(&self.0, Rc::new(v)))
        }
    }
}

#[cfg(test)]
mod tests {}
