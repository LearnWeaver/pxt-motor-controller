/**
 * Blocks for driving the BBS Motor Driver Board
 */
//% weight=100 color=#00A654 icon="\uf085" block="BBS Motor Driver"
namespace BBS_Motor_Controller {

    //Some useful parameters. 
        let ChipAddress = 0x6A //default Chip address
        let PrescaleReg = 0xFE //the prescale register address
        let Mode1Reg = 0x00  //The mode 1 register address
        
    // If you wanted to write some code that stepped through the servos then this is the BASe and size to do that 	
        let Servo1RegBase = 0x08 
        let ServoRegDistance = 4
        //To get the PWM pulses to the correct size and zero offset these are the default numbers. 
        let ServoMultiplier = 226
        let ServoZeroOffset = 0x66
    
        let initalised = false //a flag to allow us to initialise without explicitly calling the secret incantation
    
        //nice big list of servos for the block to use. These represent register offsets in the PCA9865
        export enum Servos {
            Servo1 = 0x40,
            Servo2 = 0x44
            /*Servo1 = 0x08,
            Servo2 = 0x0C,
            Servo3 = 0x10,
            Servo4 = 0x14,
            Servo5 = 0x18,
            Servo6 = 0x1C,
            Servo7 = 0x20,
            Servo8 = 0x24,
            Servo9 = 0x28,
            Servo10 = 0x2C,
            Servo11 = 0x30,
            Servo12 = 0x34,
            Servo13 = 0x38,
            Servo14 = 0x3C,
            Servo15 = 0x40,
            Servo16 = 0x44,*/
        }

        export enum Motors {
            Motor1 = 1,
            Motor2 = 2,
            Motor3 = 3,
            Motor4 = 4
            /*Motor1 = 0x08,
            Motor2 = 0x0C,
            Motor3 = 0x10,
            Motor4 = 0x14,
            Servo5 = 0x18,
            Servo6 = 0x1C,
            Servo7 = 0x20,
            Servo8 = 0x24,
            Servo9 = 0x28,
            Servo10 = 0x2C,
            Servo11 = 0x30,
            Servo12 = 0x34,
            Servo13 = 0x38,
            Servo14 = 0x3C,
            Servo15 = 0x40,
            Servo16 = 0x44,*/
        }
    
        export enum BoardAddresses{
            Board1 = 0x6A,
            
        }
        //Trim the servo pulses. These are here for advanced users, and not exposed to blocks.
        //It appears that servos I've tested are actually expecting 0.5 - 2.5mS pulses, 
        //not the widely reported 1-2mS 
        //that equates to multiplier of 226, and offset of 0x66
        // a better trim function that does the maths for the end user could be exposed, the basics are here 
        // for reference
    
        export function TrimServoMultiplier(Value: number) {
            if (Value < 113) {
                ServoMultiplier = 113
            }
            else {
                if (Value > 226) {
                    ServoMultiplier = 226
                }
                else {
                    ServoMultiplier = Value
                }
    
            }
        }
        export function TrimServoZeroOffset(Value: number) {
            if (Value < 0x66) {
                ServoZeroOffset = 0x66
            }
            else {
                if (Value > 0xCC) {
                    ServoZeroOffset = 0xCC
                }
                else {
                    ServoZeroOffset = Value
                }
    
            }
        }
    
        /*
            This secret incantation sets up the PCA9865 I2C driver chip to be running at 50Hx pulse repetition, and then sets the 16 output registers to 1.5mS - centre travel.
            It should not need to be called directly be a user - the first servo write will call it.
        
        */
        function secretIncantation(): void {
            let buf = pins.createBuffer(2)
    
           
            // First set the prescaler to 50 hz
            buf[0] = PrescaleReg
            buf[1] = 0x85
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            //Block write via the all leds register to set all of them to 90 degrees
            buf[0] = 0xFA
            buf[1] = 0x00
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            buf[0] = 0xFB
            buf[1] = 0x00
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            buf[0] = 0xFC
            buf[1] = 0x66
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            buf[0] = 0xFD
            buf[1] = 0x00
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            //Set the mode 1 register to come out of sleep
            buf[0] = Mode1Reg
            buf[1] = 0x01
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            //set the initalised flag so we dont come in here again automatically
            initalised = true
        }

        /**
         * Sets the requested motor to the given speed.
         * if the PCA has not yet been initialised calls the initialisation routine
         *
         * @param Motor Which motor to set
         * @param speed the angle to set the servo to
         */
        //% blockId=bbs_I2Cmotor_write
        //% block="set%Motor|to%speed"
        //% speed.min=0 speed.max=100
        
        export function MotorWrite(Motor: Motors, speed: number): void {
            if (initalised == false) {
                secretIncantation()
            }

            //need to look at the speed and motor number to determine the pins to activate.
            let m1pin1 = 0;
            let m1pin2 = 0;
            let m1pwm = 0;
            
            if(Motor == Motors.Motor1){
                m1pin1 = 0x08;
                m1pin2 = 0x0C;
                m1pwm = 0x10;
            }

            if(Motor == Motors.Motor2){
                m1pin1 = 0x14;
                m1pin2 = 0x18;
                m1pwm = 0x1C;
            }

            if(Motor == Motors.Motor3){
                m1pin1 = 0x20;
                m1pin2 = 0x24;
                m1pwm = 0x28;
            }

            if(Motor == Motors.Motor4){
                m1pin1 = 0x2C;
                m1pin2 = 0x30;
                m1pwm = 0x34;
            }
            
            let buf = pins.createBuffer(2);
            let bufPin1 = pins.createBuffer(2);
            let bufPin2 = pins.createBuffer(2);

            let HighByte = false;
            
            //power up pin 1 and 2
            if(speed > 0)
            {
                //forward
                bufPin1[0] = m1pin1;
                bufPin1[1] = 0xFF; //full on to simulate a logic on
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)            
                bufPin1[0] = m1pin1 + 1
                bufPin1[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)

                bufPin2[0] = m1pin2;
                bufPin2[1] = 0; //off - 
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)            
                bufPin2[0] = m1pin2 + 1
                bufPin2[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)


            }
            else if (speed < 0)
            {
                //reverse

                bufPin1[0] = m1pin1;
                bufPin1[1] = 0; //full off
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)            
                bufPin1[0] = m1pin1 + 1
                bufPin1[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)

                bufPin2[0] = m1pin2;
                bufPin2[1] = 0xFF; //on
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)            
                bufPin2[0] = m1pin2 + 1
                bufPin2[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)
            }
            else
            {
                //stop
                bufPin1[0] = m1pin1;
                bufPin1[1] = 0xFF; //full off
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)            
                bufPin1[0] = m1pin1 + 1
                bufPin1[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin1, false)

                bufPin2[0] = m1pin2;
                bufPin2[1] = 0xFF; //on
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)            
                bufPin2[0] = m1pin2 + 1
                bufPin2[1] = 0x00
                pins.i2cWriteBuffer(ChipAddress, bufPin2, false)
            }

            let deg100 = speed * 100
            let PWMVal100 = deg100 * ServoMultiplier
            let PWMVal = PWMVal100 / 10000
            PWMVal = Math.floor(PWMVal)
            PWMVal = PWMVal + ServoZeroOffset
            
            if (PWMVal > 0xFF) {
                HighByte = true
            }
            buf[0] = m1pwm
            buf[1] = PWMVal
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            if (HighByte) {
                buf[0] = m1pwm + 1
                buf[1] = 0x01
            }
            else {
                buf[0] = m1pwm + 1
                buf[1] = 0x00
            }
            pins.i2cWriteBuffer(ChipAddress, buf, false)
        }
        
        
    /**
         * sets the requested servo to the reguested angle.
         * if the PCA has not yet been initialised calls the initialisation routine
         *
         * @param Servo Which servo to set
         * @param degrees the angle to set the servo to
         */
        //% blockId=bbs_I2Cservo_write
        //% block="set%Servo|to%degrees"
        //% degrees.min=0 degrees.max=180
        
        export function servoWrite(Servo: Servos, degrees: number): void {
            if (initalised == false) {
                secretIncantation()
            }
            let buf = pins.createBuffer(2)
            let HighByte = false
            let deg100 = degrees * 100
            let PWMVal100 = deg100 * ServoMultiplier
            let PWMVal = PWMVal100 / 10000
            PWMVal = Math.floor(PWMVal)
            PWMVal = PWMVal + ServoZeroOffset
            if (PWMVal > 0xFF) {
                HighByte = true
            }
            buf[0] = Servo
            buf[1] = PWMVal
            pins.i2cWriteBuffer(ChipAddress, buf, false)
            if (HighByte) {
                buf[0] = Servo + 1
                buf[1] = 0x01
            }
            else {
                buf[0] = Servo + 1
                buf[1] = 0x00
            }
            pins.i2cWriteBuffer(ChipAddress, buf, false)
        }
            
    
    }