use std::cell::RefMut;
use std::collections::HashMap;
use std::ops::Deref;

use log::debug;
use pest::error::Error;

use crate::ast::ast::{
    AstPair, BinaryOperator, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement,
};
use crate::ast::util::custom_error_span;
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::matcher::{assign_definitions, match_expression};
use crate::interpret::value::Value;
use crate::parser::Rule;

pub trait Evaluate {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let mut last_res = self.map(|_| Value::Unit);
        for statement in &self.1.statements {
            last_res = statement.eval(ctx, eager)?;
        }
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Statement> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Statement::Expression(exp) => exp.eval(ctx, eager),
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs =
                    assign_definitions(assignee.clone(), expression.clone(), ctx, |i, e| {
                        Definition::User(i, e)
                    })?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
                Ok(self.map(|_| Value::Unit))
            }
            Statement::Return(_) => todo!(),
        }
    }
}

impl Evaluate for AstPair<Expression> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx, eager),
            Expression::Unary { operator, operand } => {
                let fc = FunctionCall {
                    identifier: operator.map(|o| Identifier(format!("{}", o))),
                    parameters: vec![operand.deref().clone()],
                };
                let a = self.map(|_| fc.clone());
                function_call(&a, ctx)
            }
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                if operator.1 == BinaryOperator::Accessor {
                    let l = left_operand.eval(ctx, true)?;
                    ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
                    right_operand.eval(ctx, eager)
                } else {
                    let fc = FunctionCall {
                        identifier: operator.map(|o| Identifier(format!("{}", o))),
                        parameters: vec![left_operand, right_operand]
                            .into_iter()
                            .map(|p| p.deref())
                            .cloned()
                            .collect(),
                    };
                    let a = self.map(|_| fc.clone());
                    function_call(&a, ctx)
                }
            }
            Expression::MatchExpression { .. } => {
                let p_match = match_expression(self.clone(), ctx)?;
                if let Some((clause, pm)) = p_match {
                    ctx.scope_stack.push(Scope {
                        name: "<match_predicate>".to_string(),
                        definitions: pm.into_iter().collect(),
                        callee: Some(clause.0.clone()),
                        params: vec![],
                        method_callee: None,
                    });
                    debug!("push scope {:?}", &ctx.scope_stack.last().unwrap());

                    let res = clause.1.block.eval(ctx, true);

                    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                    ctx.scope_stack.pop();

                    res.map_err(|e| {
                        custom_error_span(
                            &clause.1.block.0,
                            &ctx.ast_context,
                            format!("in match clause:\n{}", e),
                        )
                    })
                } else {
                    todo!()
                }
            }
        }
    }
}

pub fn function_call(
    function_call: &AstPair<FunctionCall>,
    ctx: &mut RefMut<Context>,
) -> Result<AstPair<Value>, Error<Rule>> {
    let mut params: Vec<AstPair<Value>> = vec![];
    if let Some(mc) = ctx.scope_stack.last().unwrap().method_callee.clone() {
        params.push(mc);
    }
    let ps: Vec<AstPair<Value>> = function_call
        .1
        .parameters
        .iter()
        .map(|a| a.eval(ctx, false))
        .collect::<Result<_, _>>()?;
    params.extend(ps);
    let name = function_call.1.identifier.1.clone().0;
    ctx.scope_stack.push(Scope {
        name: name.clone(),
        definitions: HashMap::new(),
        callee: Some(function_call.0.clone()),
        params: params.clone(),
        method_callee: None,
    });
    debug!("push scope @{}", name);

    let id = &function_call.1.identifier;
    debug!("function call {:?}, params: {:?}", &function_call, &params);
    let res = match ctx.find_definition(&id.1) {
        Some(Definition::User(_, exp)) => exp.eval(ctx, true),
        Some(Definition::System(f)) => f(params.clone(), ctx),
        Some(Definition::Value(v)) => Ok(v),
        None => Err(custom_error_span(
            &function_call.0,
            &ctx.ast_context,
            format!("Function '{}' not found", id.1),
        )),
    };
    debug!("function {:?} result {:?}", &id, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();
    res.map_err(|e| {
        custom_error_span(
            &function_call.0,
            &ctx.ast_context,
            format!("in function call '{}':\n{}", id.1, e),
        )
    })
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Operand::Integer(i) => Ok(self.map(|_| Value::I(*i))),
            Operand::Float(f) => Ok(self.map(|_| Value::F(*f))),
            Operand::Boolean(b) => Ok(self.map(|_| Value::B(*b))),
            Operand::String(s) => {
                // TODO: assign each list item correct span
                Ok(self.map(|_| Value::List {
                    items: s.chars().map(|c| Value::C(c)).collect(),
                    spread: false,
                }))
            }
            Operand::FunctionCall(fc) => function_call(&self.map(|_| fc.clone()), ctx),
            Operand::FunctionInit(fi) => self.map(|_| fi.clone()).eval(ctx, eager),
            Operand::ListInit { items } => {
                let l = Value::List {
                    items: match items
                        .into_iter()
                        .map(|i| {
                            let v = i.eval(ctx, eager).map(|a| a.1);
                            v
                        })
                        .collect::<Result<Vec<_>, _>>()
                    {
                        Ok(r) => r
                            .into_iter()
                            .flat_map(|i| match i {
                                Value::List {
                                    items,
                                    spread: true,
                                } => items,
                                _ => vec![i],
                            })
                            .collect(),
                        Err(e) => {
                            return Err(custom_error_span(
                                &self.0,
                                &ctx.ast_context,
                                format!("Error constructing list:\n{}", e),
                            ));
                        }
                    },
                    spread: false,
                };
                Ok(self.map(|_| l.clone()))
            }
            Operand::Identifier(i) => i.eval(ctx, eager),
            _ => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

impl Evaluate for AstPair<FunctionInit> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        if eager {
            let scope = ctx.scope_stack.last().unwrap().clone();
            for (arg, v) in self.1.arguments.iter().zip(scope.params.clone()) {
                let defs = assign_definitions(arg.clone(), v, ctx, |_, e| Definition::Value(e))?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
            }
            debug!(
                "eval function init scope @{}: {:?}",
                &scope.clone().name,
                &scope.clone().definitions
            );
            self.1.block.eval(ctx, eager)
        } else {
            Ok(AstPair::from_span(&self.0, Value::Fn(self.1.clone())))
        }
    }
}

impl Evaluate for AstPair<Identifier> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.eval(ctx, eager),
            None => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Identifier '{}' not found", self.1),
            )),
        };
        debug!("result {:?}: {:?}", &self, res);
        res
    }
}

/// Evaluate lazy values
impl Evaluate for AstPair<Value> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval value {:?}, eager: {}", &self, eager);
        if !eager {
            return Ok(self.clone());
        }
        match &self.1 {
            Value::Fn(f) => self.map(|_| f.deref().clone()).eval(ctx, eager),
            _ => Ok(self.clone()),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match self {
            Definition::User(_, exp) => exp.eval(ctx, eager),
            // TODO: check if it's ok to clone params
            Definition::System(f) => f(ctx.scope_stack.last().unwrap().clone().params, ctx),
            Definition::Value(v) => Ok(v.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::vec;

    use pest::error::Error;
    use pest::Parser;

    use crate::ast::ast::AstContext;
    use crate::ast::ast_parser::parse_block;
    use crate::interpret::context::Context;
    use crate::interpret::evaluate::Evaluate;
    use crate::interpret::value::Value;
    use crate::parser::{NoisParser, Rule};

    fn evaluate(source: &str, eager: bool) -> Result<Value, Error<Rule>> {
        let a_ctx = AstContext {
            input: source.to_string(),
        };
        let pt = NoisParser::parse(Rule::program, a_ctx.input.as_str());
        let ast = pt.and_then(|parsed| parse_block(&parsed.into_iter().next().unwrap()))?;
        let ctx_cell = RefCell::new(Context::stdlib(a_ctx));
        let ctx = &mut ctx_cell.borrow_mut();
        ast.eval(ctx, eager).map(|a| a.1)
    }

    fn evaluate_eager(source: &str) -> Result<Value, Error<Rule>> {
        evaluate(source, true)
    }

    #[test]
    fn evaluate_literals() {
        assert_eq!(evaluate_eager(""), Ok(Value::Unit));
        assert_eq!(evaluate_eager("{}"), Ok(Value::Unit));
        assert_eq!(evaluate_eager("4"), Ok(Value::I(4)));
        assert_eq!(evaluate_eager("4.56"), Ok(Value::F(4.56)));
        assert_eq!(evaluate_eager("1e12"), Ok(Value::F(1e12)));
        assert_eq!(
            evaluate_eager("'a'").map(|r| r.to_string()),
            Ok("a".to_string())
        );
        assert_eq!(
            evaluate_eager("[]"),
            Ok(Value::List {
                items: vec![],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("[1, 2]"),
            Ok(Value::List {
                items: vec![Value::I(1), Value::I(2)],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("'ab'"),
            Ok(Value::List {
                items: vec![Value::C('a'), Value::C('b')],
                spread: false,
            })
        );
        assert_eq!(
            evaluate_eager("[1, 'b']"),
            Ok(Value::List {
                items: vec![
                    Value::I(1),
                    Value::List {
                        items: vec![Value::C('b')],
                        spread: false,
                    },
                ],
                spread: false,
            })
        );
        assert!(matches!(evaluate("a -> a", false), Ok(Value::Fn(..))));
    }

    #[test]
    fn evaluate_assignee_basic() {
        assert_eq!(evaluate_eager("a = 4\na"), Ok(Value::I(4)));
        assert_eq!(evaluate_eager("_ = 4"), Ok(Value::Unit));
        assert_eq!(evaluate_eager("[a, b] = [1, 2]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate_eager("[a, b] = [1, 2]\nb"), Ok(Value::I(2)));
        assert_eq!(evaluate_eager("[a, b] = [1, 2, 3]\na").is_err(), true);
        assert_eq!(evaluate_eager("[a, _, c] = [1, 2, 3]\nc"), Ok(Value::I(3)));
        assert_eq!(
            evaluate_eager("[_, [c, _]] = [[1, 2], [3, 4]]\nc"),
            Ok(Value::I(3))
        );
    }

    // TODO: more tests
}
