use std::cell::RefMut;
use std::rc::Rc;

use crate::ast::ast_pair::AstPair;
use crate::ast::operand::Operand;
use log::debug;

use crate::error::Error;
use crate::interpret::context::{Context, Definition};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::value::Value;

impl Evaluate for AstPair<Rc<Operand>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        match self.1.as_ref() {
            Operand::Integer(i) => Ok(self.with(Rc::new(Value::I(*i)))),
            Operand::Float(f) => Ok(self.with(Rc::new(Value::F(*f)))),
            Operand::Boolean(b) => Ok(self.with(Rc::new(Value::B(*b)))),
            Operand::String(s) => Ok(self.with(Rc::new(Value::List {
                items: Rc::new(s.chars().map(Value::C).collect()),
                spread: false,
            }))),
            Operand::ValueType(vt) => Ok(self.with(Rc::new(Value::Type(vt.clone())))),
            Operand::FunctionInit(fi) => AstPair(self.0, Rc::new(fi.clone())).eval(ctx),
            Operand::ListInit { items } => {
                let l = Value::List {
                    items: match items
                        .iter()
                        .map(|i| i.map(|v| Rc::new(v.clone())).eval(ctx).map(|a| a.1))
                        .collect::<Result<Vec<_>, _>>()
                    {
                        Ok(r) => Rc::new(
                            r.into_iter()
                                .flat_map(|i| match i.as_ref() {
                                    Value::List {
                                        items,
                                        spread: true,
                                    } => items.as_ref().clone(),
                                    v => vec![v.clone()],
                                })
                                .collect(),
                        ),
                        Err(e) => {
                            return Err(Error::new_cause(
                                e,
                                "<list construction>".to_string(),
                                &self.0,
                                &ctx.ast_context,
                            ));
                        }
                    },
                    spread: false,
                };
                Ok(self.with(Rc::new(l)))
            }
            Operand::Identifier(i) => {
                let res = i.map(|v| Rc::new(v.clone())).eval(ctx);
                if let Ok(r) = &res {
                    debug!("replacing definition {} with concrete value: {:?}", i.1, r);
                    if let Some(d) = ctx.find_definition_mut(&i.1) {
                        *d = Definition::Value(r.map(Rc::clone))
                    }
                }
                res
            }
            _ => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

#[cfg(test)]
mod tests {}
