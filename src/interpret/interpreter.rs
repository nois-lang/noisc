use crate::ast::ast::{AstPair, Block};
use crate::interpret::context::Context;

pub fn execute(block: AstPair<Block>) {
    let ctx = Context::new();
    println!("{:#?}", ctx);
    todo!()
}
