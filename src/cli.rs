use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(version, about, long_about = None, propagate_version = true)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Commands,

    #[clap(
        global = true,
        short,
        long,
        required = false,
        takes_value = false,
        help = "Detailed output"
    )]
    pub verbose: bool,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    #[clap(about = "Validate syntax and generate AST")]
    Parse {
        #[clap(value_parser, help = "Path to source file")]
        source: String,
    },

    #[clap(about = "Run source file")]
    Run {
        #[clap(value_parser, help = "Path to source file")]
        source: String,

        #[clap(multiple = true)]
        args: Vec<String>,
    },

    #[clap(about = "Start interactive interpreter")]
    Repl {
        #[clap(multiple = true)]
        args: Vec<String>,
    },
}
