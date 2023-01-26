use crate::ast::ast_pair::AstPair;
use crate::ast::expression::Expression;
use std::fmt;
use std::fmt::{Display, Formatter};

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum UnaryOperator {
    Plus,
    Minus,
    Not,
    Spread,
    ArgumentList(Vec<AstPair<Expression>>),
}

impl Display for UnaryOperator {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                UnaryOperator::Plus => "+",
                UnaryOperator::Minus => "-",
                UnaryOperator::Not => "!",
                UnaryOperator::Spread => "..",
                UnaryOperator::ArgumentList(..) => "()",
            }
        )
    }
}
