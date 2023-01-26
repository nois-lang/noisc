use std::cell::{RefCell, RefMut};
use std::collections::HashMap;
use std::mem::take;
use std::rc::Rc;

use log::debug;

use crate::ast::ast::{AstPair, AstScope, Block, Identifier};
use crate::error::{terminate, Error};
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::destructure::AssignmentPair;
use crate::interpret::evaluate::Evaluate;

pub fn execute<F>(block: AstPair<Block>, ctx: Context, mut update_ctx: F)
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
        definitions: block_defs.into_iter().map(|(i, _)| (i, None)).collect(),
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
        _ => terminate(format!("'{}' not found", identifier)),
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
