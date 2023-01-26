use crate::ast::ast_pair::{AstPair, Span};
use crate::ast::expression::Expression;
use crate::ast::identifier::Identifier;
use crate::ast::operand::Operand;
use std::rc::Rc;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub struct FunctionCall {
    pub callee: AstPair<Rc<Expression>>,
    pub arguments: Vec<AstPair<Rc<Expression>>>,
}

impl FunctionCall {
    pub fn new_by_name(span: Span, name: &str, args: Vec<AstPair<Rc<Expression>>>) -> FunctionCall {
        let exp = Expression::Operand(Box::new(AstPair(
            span,
            Operand::Identifier(AstPair(span, Identifier::new(name))),
        )));
        FunctionCall {
            callee: AstPair(span, Rc::new(exp)),
            arguments: args,
        }
    }

    pub fn as_identifier(&self) -> Option<&AstPair<Identifier>> {
        match self.callee.1.as_ref() {
            Expression::Operand(o) => match &o.1 {
                Operand::Identifier(a @ AstPair(_, Identifier(_))) => Some(a),
                _ => None,
            },
            _ => None,
        }
    }
}
