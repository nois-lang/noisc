use std::cell::RefCell;
use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;

use crate::ast::ast::{AstContext, AstPair, Block, Identifier};
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::evaluate::Evaluate;

pub fn execute(block: AstPair<Block>, a_ctx: AstContext) {
    let ctx_cell = RefCell::new(Context::stdlib(a_ctx));
    let ctx = &mut ctx_cell.borrow_mut();
    let block_defs = block
        .1
        .statements
        .into_iter()
        .flat_map(|s| s.1.as_definitions())
        .collect::<HashMap<_, _>>();
    let identifier = Identifier::new("main");
    ctx.scope_stack.push(Scope {
        name: "global".to_string(),
        definitions: block_defs,
        callee: None,
        params: vec![],
        method_callee: None,
    });
    ctx.scope_stack.push(Scope {
        name: "main".to_string(),
        definitions: HashMap::new(),
        callee: None,
        params: vec![],
        method_callee: None,
    });
    let (main_id, main) = match ctx.find_definition(&identifier) {
        Some(Definition::User(id, exp)) => (id, exp),
        _ => {
            eprintln!("{}", format!("'{}' function not found", identifier).red());
            exit(1)
        }
    };
    let mut a = ctx.scope_stack.last_mut().unwrap();
    a.callee = Some(main_id.0);
    match main.eval(ctx, true) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("{}", format!("{}", e).red())
        }
    };
    ctx.scope_stack.pop();
}
