use std::fmt;
use std::fmt::{Display, Formatter};

#[derive(Debug, PartialOrd, PartialEq, Clone, Eq, Hash)]
pub struct Identifier(pub String);

impl Identifier {
    pub fn new(name: &str) -> Identifier {
        Identifier(name.to_string())
    }
}

impl Display for Identifier {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
