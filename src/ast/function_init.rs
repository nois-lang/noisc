use crate::ast::ast_pair::AstPair;
use crate::ast::block::Block;
use crate::ast::destructure::Assignee;
use crate::ast::identifier::Identifier;
use std::rc::Rc;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct FunctionInit {
    pub parameters: Vec<AstPair<Assignee>>,
    pub block: AstPair<Rc<Block>>,
    pub closure: Vec<Identifier>,
}
