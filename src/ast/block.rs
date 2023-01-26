use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::ast::statement::Statement;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct Block {
    pub statements: Vec<AstPair<Rc<Statement>>>,
}
