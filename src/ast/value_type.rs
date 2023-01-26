use std::fmt;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};

#[derive(Debug, PartialOrd, Clone, Eq)]
pub enum ValueType {
    // TODO: differentiation between unit type and unit value initialization
    Unit,
    Integer,
    Float,
    Char,
    Boolean,
    Function,
    Any,
    Type,
}

impl Hash for ValueType {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.to_string().hash(state);
    }
}

impl PartialEq for ValueType {
    fn eq(&self, other: &Self) -> bool {
        if matches!(self, Self::Any) || matches!(other, Self::Any) {
            return true;
        }
        self.to_string() == other.to_string()
    }
}

impl Display for ValueType {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                ValueType::Unit => "()".to_string(),
                ValueType::Integer => "I".to_string(),
                ValueType::Float => "F".to_string(),
                ValueType::Char => "C".to_string(),
                ValueType::Boolean => "B".to_string(),
                ValueType::Function => "Fn".to_string(),
                ValueType::Any => "*".to_string(),
                ValueType::Type => "T".to_string(),
            }
        )
    }
}
