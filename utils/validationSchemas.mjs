export const validationSchema = {
  name: {
    isString: {
      options: {},
      errorMessage:"it shuld be string"
    },
    notEmpty: {
      options: {},
      errorMessage:"is shouln't be empty"
    },
  },
  lastname: {
    isString: {
      options: {},
      errorMessage:"it shuld be string"
    },
    notEmpty: {
      options: {},
      errorMessage:"is shouln't be empty"
    },
  },
};
