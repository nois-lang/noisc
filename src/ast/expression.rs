use crate::ast::ast::BinaryOperator;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Associativity {
    Left,
    Right,
    None,
}

pub trait OperatorPrecedence {
    fn precedence(&self) -> i32;
}

pub trait OperatorAssociativity {
    fn associativity(&self) -> Associativity;
}

impl OperatorPrecedence for BinaryOperator {
    fn precedence(&self) -> i32 {
        match self {
            BinaryOperator::Add => 6,
            BinaryOperator::Subtract => 6,
            BinaryOperator::Multiply => 7,
            BinaryOperator::Divide => 7,
            BinaryOperator::Exponent => 8,
            BinaryOperator::Remainder => 7,
            BinaryOperator::Accessor => 9,
            BinaryOperator::Equals => 4,
            BinaryOperator::NotEquals => 4,
            BinaryOperator::Greater => 4,
            BinaryOperator::GreaterOrEquals => 4,
            BinaryOperator::Less => 4,
            BinaryOperator::LessOrEquals => 4,
            BinaryOperator::And => 3,
            BinaryOperator::Or => 2,
        }
    }
}

impl OperatorAssociativity for BinaryOperator {
    fn associativity(&self) -> Associativity {
        match self {
            BinaryOperator::Add => Associativity::Left,
            BinaryOperator::Subtract => Associativity::Left,
            BinaryOperator::Multiply => Associativity::Left,
            BinaryOperator::Divide => Associativity::Left,
            BinaryOperator::Exponent => Associativity::Right,
            BinaryOperator::Remainder => Associativity::Left,
            BinaryOperator::Accessor => Associativity::Left,
            BinaryOperator::Equals => Associativity::None,
            BinaryOperator::NotEquals => Associativity::None,
            BinaryOperator::Greater => Associativity::None,
            BinaryOperator::GreaterOrEquals => Associativity::None,
            BinaryOperator::Less => Associativity::None,
            BinaryOperator::LessOrEquals => Associativity::None,
            BinaryOperator::And => Associativity::Right,
            BinaryOperator::Or => Associativity::Right,
        }
    }
}
