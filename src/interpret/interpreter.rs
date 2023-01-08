use std::cell::RefCell;
use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;
use log::debug;

use crate::ast::ast::{AstContext, AstPair, Block, Identifier};
use crate::error::Error;
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute(block: AstPair<Block>, a_ctx: AstContext) {
    let ctx_cell = RefCell::new(Context::stdlib(a_ctx));
    let ctx = &mut ctx_cell.borrow_mut();
    let block_defs = block
        .1
        .statements
        .into_iter()
        // TODO: proper handling
        .flat_map(|s| s.1.as_definitions(ctx).unwrap())
        .collect::<HashMap<_, _>>();
    let identifier = Identifier::new("main");
    ctx.scope_stack
        .push(Scope::new("global".to_string()).with_definitions(block_defs));
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.push(Scope::new(identifier.to_string()));
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);
    let (main_id, main) = match ctx.find_definition(&identifier) {
        Some(Definition::User(id, exp)) => (id, exp),
        _ => {
            eprintln!("{}", format!("'{}' not found", identifier).red());
            exit(1)
        }
    };
    let mut a = ctx.scope_stack.last_mut().unwrap();
    a.callee = Some(main_id.clone().0);
    match main.eval(ctx, true) {
        Ok(_) => {}
        Err(e) => {
            let err = Error::new_cause(e, main_id.1 .0, &main_id.0, &ctx.ast_context);
            eprintln!("{}", format!("{}", err).red())
        }
    };
    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();
}
