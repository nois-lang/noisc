use std::collections::HashMap;

use crate::ast::ast::Identifier;
use crate::interpret::context::Definition;
use crate::stdlib::{binary_operator, io};

#[derive(Debug)]
pub struct Package {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
}

pub fn stdlib() -> Vec<Package> {
    vec![io::package(), binary_operator::package()]
}
