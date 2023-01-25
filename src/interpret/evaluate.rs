use std::cell::RefMut;
use std::fmt::{Display, Formatter};
use std::mem::take;
use std::ops::{Deref, DerefMut};
use std::rc::Rc;

use log::debug;

use crate::ast::ast::{
    AstPair, BinaryOperator, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement, UnaryOperator,
};
use crate::error::Error;
use crate::interpret::context::{Context, Definition, Scope};
use crate::interpret::destructure::assign_definitions;
use crate::interpret::matcher::match_expression;
use crate::interpret::value::Value;

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum FunctionCallType {
    Function,
    Operator,
}

impl Display for FunctionCallType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                FunctionCallType::Function => "function",
                FunctionCallType::Operator => "operator",
            }
        )
    }
}

pub fn function_call(
    function_call: &AstPair<FunctionCall>,
    ctx: &mut RefMut<Context>,
    call_type: FunctionCallType,
) -> Result<AstPair<Rc<Value>>, Error> {
    debug!("function call {:?}", function_call);
    let mut args: Vec<AstPair<Rc<Value>>> = vec![];
    if let Some(mc) = &ctx.scope_stack.last().unwrap().method_callee {
        debug!("method call on {:?}", mc);
        args.push(mc.map(Rc::clone));
        debug!("consuming scope method callee");
        ctx.scope_stack
            .deref_mut()
            .last_mut()
            .unwrap()
            .method_callee = None;
    }
    args.extend(
        function_call
            .1
            .arguments
            .iter()
            .map(|a| a.map(Rc::clone).eval(ctx))
            .collect::<Result<Vec<_>, _>>()?,
    );

    let id = function_call.1.as_identifier();
    let name = id
        .map(|i| i.1 .0.clone())
        .unwrap_or_else(|| "<anon>".to_string());
    let mut callee = None;
    if id.is_none() {
        debug!("eval function callee {:?}", function_call.1.callee);
        callee = Some(function_call.1.callee.map(Rc::clone).eval(ctx)?);
        debug!("function callee {:?}", callee);
    }

    debug!("push scope @{}", name);
    ctx.scope_stack.push(take(
        Scope::new(name.to_string())
            .with_callee(Some(function_call.0))
            .with_arguments(Some(args)),
    ));

    let res = if let Some(i) = id {
        match ctx.find_definition(&i.1) {
            Some(d) => d.clone().eval(ctx),
            None => Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("{} '{}' not found", call_type, name),
            )),
        }
    } else {
        let callee_rc = callee.unwrap().1;
        if !matches!(callee_rc.as_ref(), Value::Closure(..)) {
            return Err(Error::from_span(
                &function_call.0,
                &ctx.ast_context,
                format!("expression not callable: {}", callee_rc),
            ));
        }
        function_call.with(callee_rc).eval(ctx)
    };
    debug!("{} {:?} result {:?}", &call_type, &name, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();

    res.map_err(|e| Error::new_cause(e, name, &function_call.0, &ctx.ast_context))
}

pub trait Evaluate {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error>;
}

impl Evaluate for AstPair<Rc<Block>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        let mut last_res = self.with(Rc::new(Value::Unit));
        for statement in &self.1.statements {
            last_res = statement.map(|v| Rc::new(v.clone())).eval(ctx)?;
            let scope = ctx.scope_stack.last().unwrap();
            if let Some(rv) = scope.return_value.as_ref() {
                debug!("block interrupted by return, value: {:?}", &rv);
                return Ok(statement.with(Rc::clone(rv)));
            }
        }
        debug!("block return value: {:?}", last_res);
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Rc<Statement>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        let unit = Ok(self.with(Rc::new(Value::Unit)));
        debug!("eval {:?}", &self);
        match self.1.as_ref() {
            Statement::Expression(exp) => exp.map(|v| Rc::new(v.clone())).eval(ctx),
            // TODO: reassignment
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs = assign_definitions(
                    assignee,
                    expression.map(|v| Rc::new(v.clone())),
                    ctx,
                    Definition::User,
                )?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
                unit
            }
            Statement::Return(v) => {
                let return_value = match v {
                    Some(a) => a.map(|v| Rc::new(v.clone())).eval(ctx)?.1,
                    None => Rc::new(Value::Unit),
                };
                debug!("return value: {:?}", &return_value);
                ctx.scope_stack.last_mut().unwrap().return_value = Some(return_value);
                unit
            }
        }
    }
}

impl Evaluate for AstPair<Rc<Expression>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        match self.1.as_ref() {
            Expression::Operand(op) => op.deref().map(|v| Rc::new(v.clone())).eval(ctx),
            Expression::Unary { operator, operand }
                if matches!(&operator.1, UnaryOperator::ArgumentList(..)) =>
            {
                let args = match &operator.1 {
                    UnaryOperator::ArgumentList(args) => {
                        args.iter().map(|a| a.map(|v| Rc::new(v.clone()))).collect()
                    }
                    _ => unreachable!(),
                };
                let fc = FunctionCall {
                    callee: self.with(Rc::new(operand.deref().1.clone())),
                    arguments: args,
                };
                function_call(&self.with(fc), ctx, FunctionCallType::Function)
            }
            Expression::Unary { operator, operand } => {
                let fc = FunctionCall::new_by_name(
                    operator.deref().0,
                    operator.1.to_string().as_str(),
                    vec![operand.deref().map(|v| Rc::new(v.clone()))],
                );
                let a = self.with(fc);
                function_call(&a, ctx, FunctionCallType::Operator)
            }
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                if operator.1 == BinaryOperator::Accessor {
                    let l = left_operand.deref().map(|v| Rc::new(v.clone())).eval(ctx)?;
                    ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
                    right_operand.deref().map(|v| Rc::new(v.clone())).eval(ctx)
                } else {
                    let fc = FunctionCall::new_by_name(
                        operator.deref().0,
                        operator.1.to_string().as_str(),
                        vec![left_operand, right_operand]
                            .into_iter()
                            .map(|p| p.deref().map(|v| Rc::new(v.clone())))
                            .collect(),
                    );
                    let a = self.with(fc);
                    function_call(&a, ctx, FunctionCallType::Function)
                }
            }
            Expression::MatchExpression { .. } => {
                let p_match = match_expression(&self, ctx)?;
                match p_match {
                    Some((clause, pm)) => {
                        ctx.scope_stack.push(take(
                            Scope::new("<match_predicate>".to_string())
                                .with_definitions(pm.into_iter().collect())
                                .with_callee(Some(clause.0)),
                        ));
                        debug!("push scope {:?}", &ctx.scope_stack.last().unwrap());

                        let res = clause.1.block.map(|v| Rc::new(v.clone())).eval(ctx);
                        let rv: Option<Rc<Value>> = ctx
                            .scope_stack
                            .last()
                            .unwrap()
                            .return_value
                            .as_ref()
                            .map(Rc::clone);

                        debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
                        ctx.scope_stack.pop();

                        if let Some(v) = rv {
                            debug!("propagating return from match clause, value: {:?}", v);
                            ctx.scope_stack.last_mut().unwrap().return_value = Some(v);
                        }

                        res.map_err(|e| {
                            Error::new_cause(
                                e,
                                "<match clause>".to_string(),
                                &clause.1.block.0,
                                &ctx.ast_context,
                            )
                        })
                    }
                    None => {
                        debug!("no matches in match expression {:?}", &self);
                        Ok(self.with(Rc::new(Value::Unit)))
                    }
                }
            }
        }
    }
}

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
                // TODO: check that updates the right def, not the one higher in scope
                if let Ok(r) = &res {
                    debug!("replacing {} definition with concrete value: {:?}", i.1, r);
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

impl Evaluate for AstPair<Rc<FunctionInit>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", self);
        // if scope has args, this is a function call and function init must be evaluated
        if let Some(args) = ctx.scope_stack.last().unwrap().arguments.as_ref() {
            debug!("function init args: {:?}", args);
            for (param, v) in self.1.parameters.iter().zip(args.clone()) {
                let defs = assign_definitions(param, v.clone(), ctx, |_, e| Definition::Value(e))?;
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
            }

            let s = ctx.scope_stack.last().unwrap();
            debug!("consuming scope @{} arguments: {:?}", s.name, s.arguments);
            debug!("function init scope @{}: {:?}", s.name, s.definitions);

            ctx.scope_stack.last_mut().unwrap().arguments = None;
            self.clone().1.block.map(|v| Rc::new(v.clone())).eval(ctx)
        } else {
            let closure = &self.1.closure;
            let v = if closure.is_empty() {
                Value::Fn(self.1.as_ref().clone())
            } else {
                let defs = closure
                    .iter()
                    .cloned()
                    .map(|i| {
                        let def = ctx.find_definition(&i).unwrap_or_else(|| {
                            panic!("identifier {} not found: (required for closure)", i)
                        });
                        Ok((i, def.clone()))
                    })
                    .collect::<Result<_, _>>()?;
                debug!("lazy init function with context snapshot {:?}", &ctx);
                // TODO: pass required definitions
                Value::Closure(self.1.as_ref().clone(), defs)
            };
            Ok(AstPair::from_span(&self.0, Rc::new(v)))
        }
    }
}

impl Evaluate for AstPair<Rc<Identifier>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.clone().eval(ctx),
            None => Err(Error::from_span(
                &self.0,
                &ctx.ast_context,
                format!("identifier '{}' not found", self.1),
            )),
        };
        debug!("result {:?}: {:?}", &self, res);
        res
    }
}

impl Evaluate for AstPair<Rc<Value>> {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval value {:?}", &self);
        let args = &ctx.scope_stack.last().unwrap().arguments;
        if args.is_some() {
            match self.1.as_ref() {
                Value::Fn(f) => {
                    debug!("eval function {:?}", f);
                    self.with(Rc::new(f.clone())).eval(ctx)
                }
                Value::Closure(f, defs) => {
                    debug!("eval closure {:?}", f);
                    debug!("extending scope with captured definitions: {:?}", defs);
                    ctx.scope_stack
                        .last_mut()
                        .unwrap()
                        .definitions
                        .extend(defs.clone());
                    self.with(Rc::new(f.clone())).eval(ctx)
                }
                Value::System(sf) => {
                    // TODO: store sys function name
                    debug!("eval system function");
                    sf.0(args.as_ref().unwrap().clone(), ctx).map(|a| a.map(|v| Rc::new(v.clone())))
                }
                _ => Ok(self),
            }
        } else {
            Ok(self)
        }
    }
}

impl Evaluate for Definition {
    fn eval(self, ctx: &mut RefMut<Context>) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval definition {:?}", &self);
        let scope = ctx.scope_stack.last_mut().unwrap();
        match self {
            Definition::User(_, exp) => exp.eval(ctx),
            Definition::System(f) => {
                if scope.arguments.is_some() {
                    debug!(
                        "consuming scope @{} arguments: {:?}",
                        scope.name, scope.arguments
                    );

                    let args = scope.arguments.as_ref().unwrap().clone();
                    scope.arguments = None;

                    f.0(args, ctx).map(|a| a.map(|v| Rc::new(v.clone())))
                } else {
                    let callee = scope.callee.unwrap();
                    Ok(AstPair(callee, Rc::new(Value::System(f))))
                }
            }
            Definition::Value(v) => v.eval(ctx),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;
    use std::vec;

    use crate::ast::ast::ValueType;
    use crate::ast::ast_parser::parse_block;
    use crate::error::Error;
    use crate::interpret::context::Context;
    use crate::interpret::evaluate::Evaluate;
    use crate::interpret::value::Value;
    use crate::parser::NoisParser;

    fn evaluate(source: &str) -> Result<Value, Error> {
        let ctx = &Context::stdlib(source.to_string());
        let ctx_cell = RefCell::new(ctx.clone());
        let ctx_bm = &mut ctx_cell.borrow_mut();

        let a_ctx_cell = RefCell::new(ctx.ast_context.clone());
        let a_ctx_bm = &mut a_ctx_cell.borrow_mut();

        let pt = NoisParser::parse_program(source)?;
        let ast = parse_block(&pt, a_ctx_bm)?;
        ast.map(|v| Rc::new(v.clone()))
            .eval(ctx_bm)
            .map(|a| a.1)
            .map(|v| v.as_ref().clone())
    }

    #[test]
    fn evaluate_literals() {
        assert_eq!(evaluate(""), Ok(Value::Unit));
        assert_eq!(evaluate("4"), Ok(Value::I(4)));
        assert_eq!(evaluate("4.56"), Ok(Value::F(4.56)));
        assert_eq!(evaluate("1e12"), Ok(Value::F(1e12)));
        assert_eq!(evaluate("'a'").map(|r| r.to_string()), Ok("a".to_string()));
        assert_eq!(evaluate("[]"), Ok(Value::list(vec![])));
        assert_eq!(
            evaluate("[1, 2]"),
            Ok(Value::list(vec![Value::I(1), Value::I(2)]))
        );
        assert_eq!(
            evaluate("'ab'"),
            Ok(Value::list(vec![Value::C('a'), Value::C('b')]))
        );
        assert_eq!(
            evaluate("[1, 'b']"),
            Ok(Value::list(vec![
                Value::I(1),
                Value::list(vec![Value::C('b')])
            ]))
        );
        assert!(matches!(evaluate("a -> a"), Ok(Value::Fn(..))));
        assert_eq!(
            evaluate("[C]"),
            Ok(Value::list(vec![Value::Type(ValueType::Char)]))
        );
    }

    #[test]
    fn evaluate_assignee_basic() {
        assert_eq!(evaluate("a = 4\na"), Ok(Value::I(4)));
        assert_eq!(evaluate("_ = 4"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, b] = [1, 2]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[a, b] = [1, 2]\nb"), Ok(Value::I(2)));
        assert_eq!(evaluate("[a, b] = [1, 2, 3]\na").is_err(), true);
        assert_eq!(evaluate("[a, _, c] = [1, 2, 3]\nc"), Ok(Value::I(3)));
        assert_eq!(
            evaluate("[_, [c, _]] = [[1, 2], [3, 4]]\nc"),
            Ok(Value::I(3))
        );
    }

    #[test]
    fn evaluate_value_equality() {
        assert_eq!(evaluate("1 == 1"), Ok(Value::B(true)));
        assert_eq!(evaluate("'foo' == 'foo'"), Ok(Value::B(true)));
        assert_eq!(evaluate("'' == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == ''"), Ok(Value::B(true)));
        assert_eq!(evaluate("[] == []"), Ok(Value::B(true)));
        assert_eq!(evaluate("() == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("f = a -> {}\n f == f"), Ok(Value::B(true)));

        assert_eq!(evaluate("(a -> {}) == (a -> {})"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == 2"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == '1'"), Ok(Value::B(false)));
        assert_eq!(evaluate("1 == [1]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_value_type() {
        assert_eq!(evaluate("type(1)"), Ok(Value::Type(ValueType::Integer)));
        assert_eq!(evaluate("type(1.5)"), Ok(Value::Type(ValueType::Float)));
        assert_eq!(evaluate("type(True)"), Ok(Value::Type(ValueType::Boolean)));
        assert_eq!(
            evaluate("type([])"),
            Ok(Value::list(vec![Value::Type(ValueType::Any)]))
        );
        assert_eq!(
            evaluate("type('')"),
            Ok(Value::list(vec![Value::Type(ValueType::Any)]))
        );
        assert_eq!(
            evaluate("type('abc')"),
            Ok(Value::list(vec![Value::Type(ValueType::Char)]))
        );
        assert_eq!(evaluate("type(-> 1)"), Ok(Value::Type(ValueType::Function)));
        assert_eq!(
            evaluate("type([1, 2, 3])"),
            Ok(Value::list(vec![Value::Type(ValueType::Integer)]))
        );
        assert_eq!(
            evaluate("type([1, 'abc', 1.5])"),
            Ok(Value::list(vec![
                Value::Type(ValueType::Integer),
                Value::list(vec![Value::Type(ValueType::Char)],),
                Value::Type(ValueType::Float),
            ],))
        );
        assert_eq!(evaluate("type(C)"), Ok(Value::Type(ValueType::Type)));
        assert_eq!(
            evaluate("type(['abc'])"),
            Ok(Value::list(vec![Value::list(vec![Value::Type(
                ValueType::Char
            )])]))
        );
    }

    #[test]
    fn evaluate_value_type_equality() {
        assert_eq!(evaluate("type(1) == I"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([]) == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('') == [*]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type('a') == [C]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type(['a']) == [[C]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("type([[]]) == [[*]]"), Ok(Value::B(true)));
        assert_eq!(evaluate("* == ()"), Ok(Value::B(true)));
        assert_eq!(evaluate("I == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == *"), Ok(Value::B(true)));
        assert_eq!(evaluate("[I] == [*]"), Ok(Value::B(true)));

        assert_eq!(evaluate("type(1) == C"), Ok(Value::B(false)));
        assert_eq!(evaluate("type('a') == [I]"), Ok(Value::B(false)));
        assert_eq!(evaluate("type(['a']) == [C]"), Ok(Value::B(false)));
        assert_eq!(evaluate("[C] == [[*]]"), Ok(Value::B(false)));
        assert_eq!(evaluate("I == [*]"), Ok(Value::B(false)));
    }

    #[test]
    fn evaluate_assignee_spread_hole() {
        assert_eq!(evaluate("[..] = [1, 2, 3]"), Ok(Value::Unit));
        assert_eq!(evaluate("[a, ..] = [1, 2, 3]\na"), Ok(Value::I(1)));
        assert_eq!(evaluate("[.., a] = [1, 2, 3]\na"), Ok(Value::I(3)));
        assert_eq!(evaluate("[_, a, ..] = [1, 2, 3]\na"), Ok(Value::I(2)));
        assert_eq!(evaluate("[_, a, ..] = range(100)\na"), Ok(Value::I(1)));
    }

    #[test]
    fn evaluate_match_spread_hole() {
        assert_eq!(evaluate("match [1, 2, 3] { [..] => 5 }"), Ok(Value::I(5)));
        assert_eq!(
            evaluate("match [1, 2, 3] { [a, ..] => a }"),
            Ok(Value::I(1))
        );
        assert_eq!(
            evaluate("match range(100) { [_, .., a] => a }"),
            Ok(Value::I(99))
        );
    }

    // TODO: more tests
}
