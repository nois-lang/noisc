use std::cell::RefCell;
use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;

use crate::ast::ast::{AstPair, Block, Identifier};
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute(block: AstPair<Block>) {
    let ctx_cell = RefCell::new(Context::new());
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
    let main = match ctx.find(&identifier) {
        Some(Definition::User(_, exp)) => exp,
        _ => {
            eprintln!("{}", format!("'{}' function not found", identifier).red());
            exit(1)
        }
    };
    main.eval(ctx).expect("error during main eval");
    ctx.scope_stack.pop();
}
