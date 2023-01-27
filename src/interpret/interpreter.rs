use std::cell::{RefCell, RefMut};
use std::collections::HashMap;
use std::mem::take;
use std::rc::Rc;

use log::debug;

use crate::ast::ast_context::AstScope;
use crate::ast::ast_pair::AstPair;
use crate::ast::ast_parser::parse_block;
use crate::ast::block::Block;
use crate::ast::identifier::Identifier;
use crate::error::{terminate, Error};
use crate::interpret::context::{Context, Scope};
use crate::interpret::definition::Definition;
use crate::interpret::destructure::AssignmentPair;
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;
use crate::parser::NoisParser;

pub fn execute_file<F>(block: AstPair<Block>, ctx: Context, mut update_ctx: F)
where
    F: FnMut(&mut RefMut<Context>),
{
    let ctx_cell = RefCell::new(ctx);
    let ctx_bm = &mut ctx_cell.borrow_mut();
    let r_defs = block
        .1
        .statements
        .into_iter()
        .map(|s| s.1.as_definitions(ctx_bm))
        .collect::<Result<Vec<_>, _>>();
    let block_defs = match r_defs {
        Ok(ds) => ds
            .into_iter()
            .flat_map(|r| r.pairs)
            .map(AssignmentPair::into_tuple)
            .collect::<HashMap<_, _>>(),
        Err(e) => terminate(e.to_string()),
    };
    let identifier = Identifier::new("main");
    ctx_bm.scope_stack.push(take(
        Scope::new("global".to_string()).with_definitions(block_defs.clone()),
    ));
    ctx_bm.ast_context.scope_stack.push(AstScope {
        definitions: block_defs.into_keys().map(|i| (i, None)).collect(),
        usage: HashMap::new(),
    });
    debug!("push scope @{}", &ctx_bm.scope_stack.last().unwrap().name);

    update_ctx(ctx_bm);

    ctx_bm.scope_stack.push(take(
        Scope::new(identifier.to_string()).with_arguments(Some(Rc::new(vec![]))),
    ));
    ctx_bm.ast_context.scope_stack.push(AstScope::default());
    debug!("push scope @{}", &ctx_bm.scope_stack.last().unwrap().name);

    let (main_id, main) = match ctx_bm.find_definition(&identifier).cloned() {
        Some(Definition::User(id, exp)) => (id, exp),
        _ => terminate(format!("'{identifier}' not found")),
    };
    let mut a = ctx_bm.scope_stack.last_mut().unwrap();
    a.callee = Some(main_id.0);
    match main.eval(ctx_bm) {
        Ok(_) => {}
        Err(e) => {
            let err = Error::new_cause(e, main_id.1 .0, &main_id.0, &ctx_bm.ast_context);
            terminate(err.to_string())
        }
    };
    debug!("pop scope @{}", &ctx_bm.scope_stack.last().unwrap().name);
    ctx_bm.scope_stack.pop();
    ctx_bm.ast_context.scope_stack.pop();
}

pub fn evaluate(source: &str, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
    let pt = NoisParser::parse_program(source)?;
    let a_ctx_cell = RefCell::new(ctx.ast_context.clone());
    let ast = parse_block(&pt, &mut a_ctx_cell.borrow_mut())?;
    ast.map(|v| Rc::new(v.clone()))
        .eval(ctx)
        .map(|a| a.1)
        .map(|v| v.as_ref().clone())
}

#[cfg(test)]
pub mod test {
    use std::cell::RefCell;

    use crate::ast::ast_context::{AstContext, LintingConfig};
    use crate::error::Error;
    use crate::interpret::context::Context;
    use crate::interpret::value::Value;

    pub fn evaluate(source: &str) -> Result<Value, Error> {
        let ctx = Context::stdlib(AstContext::stdlib(
            source.to_string(),
            LintingConfig::none(),
        ));
        let ctx_cell = RefCell::new(ctx.clone());
        let ctx_bm = &mut ctx_cell.borrow_mut();

        super::evaluate(source, ctx_bm)
    }
}
