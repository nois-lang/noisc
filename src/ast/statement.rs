use crate::ast::ast_pair::AstPair;
use crate::ast::destructure::Assignee;
use crate::ast::expression::Expression;
use std::rc::Rc;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Statement {
    Return(Option<AstPair<Expression>>),
    Assignment {
        assignee: AstPair<Assignee>,
        expression: AstPair<Expression>,
    },
    Expression(AstPair<Rc<Expression>>),
}
