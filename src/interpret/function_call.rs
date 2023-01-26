use std::cell::RefMut;
use std::fmt::{Display, Formatter};
use std::mem::take;
use std::ops::DerefMut;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::ast::function_call::FunctionCall;
use log::debug;

use crate::error::Error;
use crate::interpret::context::{Context, Scope};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum FunctionCallType {
    Function,
    Operator,
}

impl Display for FunctionCallType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                FunctionCallType::Function => "function",
                FunctionCallType::Operator => "operator",
            }
        )
    }
}

pub fn function_call(
    function_call: &AstPair<FunctionCall>,
    ctx: &mut RefMut<Context>,
    call_type: FunctionCallType,
) -> Result<AstPair<Rc<Value>>, Error> {
    debug!("function call {:?}", function_call);
    let mut args: Vec<AstPair<Rc<Value>>> = vec![];
    if let Some(mc) = &ctx.scope_stack.last().unwrap().method_callee {
        debug!("method call on {:?}", mc);
        args.push(mc.map(Rc::clone));
        debug!("consuming scope method callee");
        ctx.scope_stack
            .deref_mut()
            .last_mut()
            .unwrap()
            .method_callee = None;
    }
    args.extend(
        function_call
            .1
            .arguments
            .iter()
            .map(|a| a.map(Rc::clone).eval(ctx))
            .collect::<Result<Vec<_>, _>>()?,
    );

    let id = function_call.1.as_identifier();
    let name = id
        .map(|i| i.1 .0.clone())
        .unwrap_or_else(|| "<anon>".to_string());
    let mut callee = None;
    if id.is_none() {
        debug!("eval function callee {:?}", function_call.1.callee);
        callee = Some(function_call.1.callee.map(Rc::clone).eval(ctx)?);
        debug!("function callee {:?}", callee);
    }

    debug!("push scope @{}", name);
    ctx.scope_stack.push(take(
        Scope::new(name.to_string())
            .with_callee(Some(function_call.0))
            .with_arguments(Some(Rc::new(args))),
    ));

    let res = if let Some(i) = id {
        match ctx.find_definition(&i.1) {
            Some(d) => d.clone().eval(ctx),
            None => Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("{call_type} '{name}' not found"),
            )),
        }
    } else {
        let callee_rc = callee.unwrap().1;
        if !matches!(callee_rc.as_ref(), Value::Closure(..)) {
            return Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("expression not callable: {callee_rc}"),
            ));
        }
        function_call.with(callee_rc).eval(ctx)
    };
    debug!("{} {:?} result {:?}", &call_type, &name, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();

    res.map_err(|e| Error::new_cause(e, name, &function_call.0, &ctx.ast_context))
}

#[cfg(test)]
mod test {}
