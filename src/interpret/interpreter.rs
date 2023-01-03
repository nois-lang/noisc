use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;

use crate::ast::ast::{AstPair, Block, Identifier};
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute(block: AstPair<Block>) {
    let mut ctx = Context::new();
    let block_defs = block
        .1
        .statements
        .into_iter()
        .flat_map(|s| s.1.as_definitions())
        .collect::<HashMap<_, _>>();
    ctx.scope_stack.push((
        Identifier::new(""),
        Scope {
            definitions: block_defs,
        },
    ));
    let main = match ctx.find(Identifier::new("main")) {
        Some(Definition::User(_, main)) => main,
        _ => {
            eprintln!("{}", format!("'main' function not found").red());
            exit(1)
        }
    };
    main.eval(&mut ctx).expect("error during main eval");
}
