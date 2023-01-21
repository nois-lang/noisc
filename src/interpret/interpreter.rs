use std::cell::{RefCell, RefMut};
use std::collections::HashMap;

use colored::Colorize;
use log::debug;

use crate::ast::ast::{AstContext, AstPair, Block, Identifier};
use crate::error::Error;
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute<F>(block: AstPair<Block>, a_ctx: AstContext, mut update_ctx: F)
where
    F: FnMut(&mut RefMut<Context>),
{
    let ctx_cell = RefCell::new(Context::stdlib(a_ctx));
    let ctx = &mut ctx_cell.borrow_mut();
    let r_defs = block
        .1
        .statements
        .into_iter()
        .map(|s| s.1.as_definitions(ctx))
        .collect::<Result<Vec<_>, _>>();
    let block_defs = match r_defs {
        Ok(ds) => ds.into_iter().flatten().collect::<HashMap<_, _>>(),
        Err(e) => {
            eprintln!("{}", format!("{}", e).red());
            panic!();
        }
    };
    let identifier = Identifier::new("main");
    ctx.scope_stack
        .push(Scope::new("global".to_string()).with_definitions(block_defs));
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

    update_ctx(ctx);

    // TODO: pass CLI args as main parameter, e.g. main = args {}
    ctx.scope_stack
        .push(Scope::new(identifier.to_string()).with_arguments(Some(vec![])));
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

    let (main_id, main) = match ctx.find_definition(&identifier) {
        Some(Definition::User(id, exp)) => (id, exp),
        _ => {
            eprintln!("{}", format!("'{}' not found", identifier).red());
            panic!()
        }
    };
    let mut a = ctx.scope_stack.last_mut().unwrap();
    a.callee = Some(main_id.clone().0);
    match main.eval(ctx) {
        Ok(_) => {}
        Err(e) => {
            let err = Error::new_cause(e, main_id.1 .0, &main_id.0, &ctx.ast_context);
            eprintln!("{}", format!("{}", err).red());
            panic!()
        }
    };
    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();
}
