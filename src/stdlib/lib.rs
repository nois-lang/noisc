use std::collections::HashMap;

use crate::ast::ast::Identifier;
use crate::interpret::context::Definition;
use crate::stdlib::io;

#[derive(Debug)]
pub struct Package {
    pub name: String,
    pub definitions: HashMap<Identifier, Definition>,
}

pub fn stdlib() -> Vec<Package> {
    vec![io::package()]
}
