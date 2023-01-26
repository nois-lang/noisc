use std::cell::RefMut;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for Definition {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval definition {:?}", &self);
        let scope = ctx.scope_stack.last_mut().unwrap();
        match self {
            Definition::User(_, exp) => exp.eval(ctx),
            Definition::System(f) => {
                if scope.arguments.is_some() {
                    debug!(
                        "consuming scope @{} arguments: {:?}",
                        scope.name, scope.arguments
                    );

                    let args = Rc::clone(scope.arguments.as_ref().unwrap());
                    scope.arguments = None;

                    f.0(args.as_ref(), ctx).map(|a| a.map(|v| Rc::new(v.clone())))
                } else {
                    let callee = scope.callee.unwrap();
                    Ok(AstPair(callee, Rc::new(Value::System(f))))
                }
            }
            Definition::Value(v) => v.eval(ctx),
        }
    }
}

#[cfg(test)]
mod tests {}
