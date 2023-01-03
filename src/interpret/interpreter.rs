use std::cell::RefCell;
use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;

use crate::ast::ast::{AstContext, AstPair, Block, Identifier};
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute(block: AstPair<Block>, a_ctx: AstContext) {
    let ctx_cell = RefCell::new(Context::new(a_ctx));
    let ctx = &mut ctx_cell.borrow_mut();
    let block_defs = block
        .1
        .statements
        .into_iter()
        .flat_map(|s| s.1.as_definitions())
        .collect::<HashMap<_, _>>();
    ctx.scope_stack.push((
        Identifier::new("global"),
        Scope {
            definitions: block_defs,
            params: vec![],
        },
    ));
    let identifier = Identifier::new("main");
    ctx.scope_stack.push((identifier.clone(), Scope::default()));
    // TODO: assert that main is a function
    let main = match ctx.find_global(&identifier) {
        Some(Definition::User(_, exp)) => exp,
        _ => {
            eprintln!("{}", format!("'{}' function not found", identifier).red());
            exit(1)
        }
    };
    match main.eval(ctx) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("{}", format!("error during main eval:\n{}", e).red())
        }
    };
    ctx.scope_stack.pop();
}
